
## Correcao: Sincronizacao Automatica do Round Robin com Novos Corretores

### Problema Diagnosticado

A conta "Matriz Imobiliaria" (account_id: `90151ad5`) tem **5 corretores** cadastrados mas o `broker_round_robin` so contem **1** (Junior Cesar Rosa). Resultado: todos os 66+ leads estao sendo atribuidos exclusivamente a ele.

**Causa raiz**: Quando o round robin e criado automaticamente (pelo `apply-distribution-rules` ao receber o primeiro lead), ele captura apenas os corretores que existem naquele momento. Novos corretores adicionados posteriormente **nunca sao incluidos** na lista de rotacao.

Dados confirmados no banco:
- `broker_round_robin.broker_order`: `["76859bd7-57d4-4869-b96d-7f48fe315cdf"]` (apenas Junior)
- `profiles` na conta: 5 corretores (Junior, Pedro Gabriel, Maria Julia, Paulo Pereira, Marcelo Gomes)
- Ultimos 10 leads: todos atribuidos a `76859bd7` (Junior)

### Solucao: 2 Correcoes

#### 1. Auto-sync na edge function `apply-distribution-rules`

Antes de executar o round robin, verificar se todos os corretores da conta estao no `broker_order`. Se houver corretores faltando, adiciona-los automaticamente ao final da lista.

```text
Logica:
1. Buscar brokers da conta (profiles)
2. Buscar broker_order do round robin
3. Para cada broker que NAO esta no broker_order -> adicionar ao final
4. Se houve mudanca -> salvar broker_order atualizado
5. Prosseguir com o round robin normalmente
```

Isso garante que mesmo que o admin esqueca de configurar manualmente, novos corretores entram na rotacao automaticamente.

#### 2. Auto-sync na UI do DistributionRulesManager

No componente `DistributionRulesManager.tsx`, ao carregar os dados, verificar se existem corretores que nao estao no `broker_order` e adiciona-los automaticamente. Tambem exibir um botao "Sincronizar Corretores" caso o usuario queira forcar a atualizacao.

**Arquivo: `src/components/DistributionRulesManager.tsx`**

No `fetchData()` (linhas 140-179), apos carregar os brokers e o round robin config:
1. Comparar `broker_order` com a lista completa de `brokers`
2. Se houver corretores faltando, adicionar ao final do `broker_order`
3. Salvar automaticamente no banco

#### 3. Correcao imediata dos dados

Atualizar o `broker_round_robin` da conta "Matriz Imobiliaria" para incluir todos os 5 corretores, e resetar o `last_broker_index` para 0 para que a distribuicao comece do inicio com a lista completa.

### Alteracoes Tecnicas

**Arquivo 1: `supabase/functions/apply-distribution-rules/index.ts`**

Na funcao `getNextRoundRobinBroker` (linhas 254-334), adicionar verificacao de sync APOS carregar o `rrConfig` e os `brokers`:

```text
// Apos linha 295 (const brokerOrder = ...)
// Verificar se todos os brokers estao no broker_order
const missingBrokers = brokers
  .filter(b => !brokerOrder.includes(b.user_id))
  .map(b => b.user_id);

if (missingBrokers.length > 0) {
  brokerOrder.push(...missingBrokers);
  // Atualizar no banco
  await supabase
    .from('broker_round_robin')
    .update({ broker_order: brokerOrder })
    .eq('id', rrConfig.id);
  console.log(`Added ${missingBrokers.length} missing brokers to round robin`);
}
```

**Arquivo 2: `src/components/DistributionRulesManager.tsx`**

No `fetchData()`, apos carregar brokers e round robin config:

```text
// Se existem brokers que nao estao no broker_order, adicionar
const currentOrder = rrConfig.broker_order || [];
const allBrokerIds = brokers.map(b => b.user_id);
const missing = allBrokerIds.filter(id => !currentOrder.includes(id));

if (missing.length > 0 && rrConfig.id) {
  const newOrder = [...currentOrder, ...missing];
  await supabase
    .from('broker_round_robin')
    .update({ broker_order: newOrder })
    .eq('id', rrConfig.id);
  // Atualizar state local
  rrConfig.broker_order = newOrder;
}
```

Tambem remover do `broker_order` corretores que nao existem mais (limpeza de fantasmas).

**Correcao imediata via SQL**: Atualizar o `broker_round_robin` da Matriz Imobiliaria com todos os 5 corretores.

### Resultado Esperado

| Cenario | Antes | Depois |
|---------|-------|--------|
| Novo corretor adicionado | Nao entra no round robin | Adicionado automaticamente na proxima execucao |
| Corretor removido | Fica na lista, erro ao tentar atribuir | Removido automaticamente (ja tratado com skip) |
| Conta Matriz Imobiliaria | 100% leads para Junior | Leads distribuidos entre os 5 corretores |
