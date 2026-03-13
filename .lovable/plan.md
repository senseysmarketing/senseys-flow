

## Ajuste do Badge de Imóvel no Kanban Card

### Problema
O badge do imóvel tem `max-w-[130px]` com `truncate`, cortando o nome. A letra "a" no início provavelmente vem do próprio título do imóvel no banco (ex: "a Casa Jardim Adelinha" — possivelmente um erro de dado, mas o truncamento é o problema de UI).

### Solução
Em `src/components/LeadKanbanCard.tsx` (linha 149):

- Remover `truncate` e `max-w-[130px]` para exibir o nome completo do imóvel
- Manter `flex-wrap` no container pai (já presente) para que o badge quebre linha se necessário
- Opcionalmente aumentar `max-w` para algo mais generoso como `max-w-full`

A letra "a" no início é parte do dado real do título do imóvel — não é um bug do código.

