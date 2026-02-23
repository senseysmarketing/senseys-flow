

## Correcao: Filtrar corretores na Configuracao Round Robin

### Problema
Ao desmarcar corretores na regra Round Robin (ex: Junior Cesar Rosa e Maria julia cintra rubim), eles continuam aparecendo na secao "Configuracao Round Robin" abaixo. Isso acontece porque a lista `orderedBrokers` (linha 521-523) exibe todos os corretores da tabela `broker_round_robin.broker_order`, sem considerar o campo `participating_broker_ids` salvo nas conditions da regra ativa.

### Solucao

Filtrar `orderedBrokers` com base nos `participating_broker_ids` da regra Round Robin ativa.

### Detalhes Tecnicos

**Arquivo: `src/components/DistributionRulesManager.tsx`**

1. Encontrar a regra round_robin ativa nas `rules` carregadas e extrair seus `participating_broker_ids`
2. Alterar o calculo de `orderedBrokers` (linha 521-523) para filtrar apenas os corretores participantes quando houver selecao parcial
3. Adicionar um indicador visual informando que nem todos os corretores participam (ex: "Mostrando apenas corretores participantes da regra ativa")

Logica da alteracao:

```
// Antes (mostra todos):
const orderedBrokers = roundRobinConfig?.broker_order.length 
  ? roundRobinConfig.broker_order.map(id => brokers.find(...)).filter(Boolean)
  : brokers;

// Depois (filtra por participantes):
const activeRoundRobin = rules.find(r => r.rule_type === 'round_robin' && r.is_active);
const participatingIds = activeRoundRobin?.conditions?.participating_broker_ids;

const orderedBrokers = (roundRobinConfig?.broker_order.length 
  ? roundRobinConfig.broker_order.map(id => brokers.find(...)).filter(Boolean)
  : brokers
).filter(b => !participatingIds?.length || participatingIds.includes(b.user_id));
```

Tambem sera adicionada uma nota visual abaixo do titulo informando quantos corretores estao participando quando houver filtro ativo.

