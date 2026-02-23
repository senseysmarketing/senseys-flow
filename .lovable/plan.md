

## Correcao: Filtro de corretores Round Robin nao funciona quando regra esta inativa

### Problema
A regra "Distribuicao Padrao (Round Robin)" esta com `is_active = false` (toggle desligado no UI). O codigo na linha 521 filtra apenas regras ativas:
```
rules.find(r => r.rule_type === 'round_robin' && r.is_active)
```
Como a regra esta inativa, `participatingIds` fica `undefined` e todos os 5 corretores sao exibidos, ignorando a selecao de 3 participantes.

### Solucao

Alterar o filtro para considerar qualquer regra round_robin (ativa ou nao) ao exibir a lista de corretores na secao "Configuracao Round Robin".

### Detalhes Tecnicos

**Arquivo: `src/components/DistributionRulesManager.tsx` (linha 521)**

Mudar de:
```typescript
const activeRoundRobin = rules.find(r => r.rule_type === 'round_robin' && r.is_active);
```

Para:
```typescript
const activeRoundRobin = rules.find(r => r.rule_type === 'round_robin');
```

Isso garante que a selecao de participantes seja respeitada independentemente do estado ativo/inativo da regra. A logica restante permanece identica.
