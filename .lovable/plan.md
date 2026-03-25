

## Nova Regra de Distribuição: Por Tipo de Transação do Imóvel

### Conceito

Criar o tipo de regra `transaction_type` que verifica o `transaction_type` do imóvel vinculado ao lead (venda, aluguel ou venda+aluguel) e distribui entre uma lista de corretores participantes, com opção de distribuição **ordenada** (round robin dentro do grupo) ou **aleatória**.

### Mudanças Necessárias

#### 1. Edge Function `apply-distribution-rules/index.ts`

- Adicionar case `transaction_type` no `evaluateRule()`:
  - Buscar o `transaction_type` do imóvel vinculado ao lead (`properties.transaction_type`)
  - Comparar com `conditions.transaction_type` (valores: `venda`, `aluguel`, `venda_aluguel`)
  - Se lead não tem `property_id`, a regra não dá match

- No `resolveBroker()`, tratar o tipo `transaction_type`:
  - Usar `participating_broker_ids` das conditions
  - Se `conditions.distribution_mode === 'random'`, escolher aleatoriamente entre os participantes
  - Se `'ordered'` (padrão), usar o round robin existente filtrado pelos participantes

#### 2. Frontend `DistributionRulesManager.tsx`

- Adicionar na lista `RULE_TYPES`:
  ```
  { value: "transaction_type", label: "Por Tipo de Transação", icon: Building2,
    description: "Direciona leads conforme o imóvel ser de venda ou aluguel" }
  ```

- Adicionar campo `transaction_type` e `distribution_mode` no estado do form

- Adicionar UI condicional no formulário:
  - Select para tipo de transação: Venda / Aluguel / Venda e Aluguel
  - Select para modo de distribuição: Ordenada (Round Robin) / Aleatória
  - Checkbox list de corretores participantes (reutilizar padrão existente)

- Atualizar `buildConditions()` para incluir `transaction_type` e `distribution_mode`
- Atualizar `getConditionLabel()` para exibir o tipo de transação
- Atualizar `openEditDialog()` para carregar os campos ao editar
- Remover exigência de `target_broker_id` para esse tipo (usa lista de participantes)

#### 3. Fluxo de Avaliação

```text
Lead chega → property_id vinculado?
  ├── Não → regra não dá match, próxima regra
  └── Sim → busca properties.transaction_type
              ├── Compara com conditions.transaction_type
              ├── Match → seleciona corretor:
              │     ├── mode=ordered → round robin entre participating_broker_ids
              │     └── mode=random → escolha aleatória entre participating_broker_ids
              └── Não match → próxima regra
```

### Arquivos Modificados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/apply-distribution-rules/index.ts` | Adicionar avaliação e resolução do tipo `transaction_type` |
| `src/components/DistributionRulesManager.tsx` | Adicionar tipo na UI, campos de formulário e lógica de build/parse |

Nenhuma migração de banco é necessária — o tipo e condições são armazenados no campo JSONB `conditions` já existente na tabela `distribution_rules`.

