

## Seleção de Corretores Participantes por Regra de Distribuição

### Problema Atual
Todas as regras de distribuição (Round Robin, Por Carga, etc.) incluem automaticamente todos os corretores da conta. Nao ha como excluir um corretor específico de uma regra ou selecionar apenas alguns participantes.

### Solucao

Adicionar um campo `participating_broker_ids` nas conditions de cada regra, permitindo selecionar quais corretores participam. Quando vazio/nulo, todos participam (comportamento atual preservado).

### Mudancas

**1. Frontend - DistributionRulesManager.tsx**

- Adicionar ao formulario de criacao/edicao de regras uma secao "Corretores Participantes" com checkboxes para cada corretor da conta
- Um botao "Selecionar Todos" / "Desmarcar Todos" para facilitar
- Exibir esta secao para todos os tipos de regra (round_robin, workload, origin, temperature, etc.)
- Para regras que ja tem `target_broker_id` (destino fixo), manter o campo existente e nao mostrar a selecao de participantes (pois o destino ja e um corretor especifico)
- Para regras de round_robin e workload (que distribuem entre varios), mostrar a selecao de participantes
- Salvar os IDs selecionados dentro do campo `conditions` como `participating_broker_ids`
- Na Configuracao Round Robin (card inferior), filtrar a lista de corretores para mostrar apenas os participantes da regra round_robin ativa, ou todos se nenhum filtro foi definido

**2. Frontend - Formulario**

- Adicionar `participating_broker_ids: string[]` ao state do form
- Na funcao `buildConditions()`, incluir `participating_broker_ids` quando houver selecao parcial
- Na funcao `openEditDialog()`, carregar os `participating_broker_ids` existentes das conditions
- Mostrar a secao apenas para tipos round_robin e workload (os que distribuem entre multiplos corretores)

**3. Backend - apply-distribution-rules/index.ts**

- Na funcao `getNextRoundRobinBroker`, aceitar um parametro opcional `participatingBrokerIds`
- Quando fornecido, filtrar `brokerOrder` para incluir apenas os IDs participantes
- Na funcao `resolveBroker`, extrair `participating_broker_ids` das conditions da regra e passar para `getNextRoundRobinBroker`

### Detalhes Tecnicos

**State do formulario - novo campo:**
```typescript
participating_broker_ids: string[]  // vazio = todos participam
```

**UI da selecao (dentro do Dialog de criar/editar regra):**
- Secao com titulo "Corretores Participantes"
- Lista de checkboxes com nome de cada corretor
- Texto auxiliar: "Desmarque corretores que nao devem receber leads por esta regra. Se nenhum for selecionado, todos participam."
- Botao rapido "Todos" / "Nenhum"

**Conditions salvas (exemplo):**
```json
{
  "participating_broker_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Edge function - alteracao em `getNextRoundRobinBroker`:**
- Novo parametro: `participatingBrokerIds?: string[]`
- Filtrar `brokerOrder` antes de iterar: `brokerOrder.filter(id => participatingBrokerIds.includes(id))`

**Edge function - alteracao em `resolveBroker`:**
- Extrair `rule.conditions.participating_broker_ids` e passar para `getNextRoundRobinBroker`

### Compatibilidade
- Regras existentes sem `participating_broker_ids` continuam funcionando normalmente (todos participam)
- Nao requer migracao de banco - o campo `conditions` ja e JSONB flexivel
- A configuracao visual do Round Robin (card de reordenacao) continua funcionando, mas indicara quais corretores estao ativos na regra

