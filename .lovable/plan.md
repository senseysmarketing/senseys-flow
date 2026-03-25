

## Corrigir Erro ao Salvar Regra + Substituir Prioridade Numérica por Drag-and-Drop

### Problema 1: Erro ao salvar regra

O usuário logado (`matheuscorretor015@gmail.com`) é um membro de equipe (`is_team_member: true`). A policy RLS da tabela `distribution_rules` exige `is_account_owner() OR has_permission(auth.uid(), 'settings.manage')` para INSERT/UPDATE/DELETE. Além disso, existem **duas policies conflitantes**: uma `FOR SELECT` e uma `FOR ALL` — a `FOR ALL` inclui SELECT também, e quando o Postgres avalia múltiplas policies, ele usa OR entre elas. Porém, para INSERT a policy `FOR ALL` exige a verificação de owner/permissão, e se o usuário não tem essa permissão, o INSERT falha silenciosamente (RLS).

**Solução**: Verificar se o usuário tem a permissão `settings.manage` na conta e, caso não tenha, exibir mensagem clara. Também verificar se a função `has_permission` está funcionando corretamente para esse usuário. Se o problema for a RLS, ajustar para garantir que a policy funcione para membros com a permissão correta.

### Problema 2: Substituir prioridade numérica por drag-and-drop

Em vez de um campo numérico de prioridade, as regras serão exibidas como uma lista reordenável (drag-and-drop). A posição na lista define a prioridade: a regra no topo é avaliada primeiro.

### Mudanças

#### 1. `src/components/DistributionRulesManager.tsx`

- **Remover** o campo de input numérico de prioridade do formulário de criação/edição (linhas 983-996)
- **Remover** o badge `P: {rule.priority}` da lista de regras (linhas 1054-1056)
- **Substituir** a lista estática de regras por uma lista com `DragDropContext/Droppable/Draggable` (já tem a lib `@hello-pangea/dnd` importada)
- Ao criar uma nova regra, atribuir `priority` automaticamente como o maior valor + 1 (posição no topo)
- Ao reordenar via drag-and-drop, atualizar o campo `priority` de todas as regras reordenadas no banco (regra no topo = maior priority, embaixo = menor)
- Adicionar `GripVertical` icon em cada regra para indicar que é arrastável
- Manter a ordenação `ORDER BY priority DESC` no fetch (regra no topo = maior número)

#### 2. Nova migração SQL (para corrigir o erro de RLS)

- Investigar e corrigir a policy RLS se necessário. A causa provável é que o usuário não tem a permissão `settings.manage`. Vou verificar isso no banco e, se for o caso, a correção é dar a permissão ao usuário ou ajustar o fluxo de UI para bloquear a ação antes.

#### 3. Edge Function `apply-distribution-rules/index.ts`

- Sem mudanças — já usa `ORDER BY priority DESC`, que continuará funcionando com os novos valores numéricos atribuídos automaticamente.

### Fluxo de Prioridade

```text
Lista visual (topo → baixo):
  [Regra A]  → priority = 300
  [Regra B]  → priority = 200  
  [Regra C]  → priority = 100

Usuário arrasta B para o topo:
  [Regra B]  → priority = 300
  [Regra A]  → priority = 200
  [Regra C]  → priority = 100
```

### Arquivos Modificados

| Arquivo | Ação |
|---------|------|
| `src/components/DistributionRulesManager.tsx` | Remover campo prioridade, adicionar drag-and-drop na lista de regras, auto-atribuir prioridade |
| Possível migração SQL | Corrigir RLS se necessário |

