
## Correcao: Corretor vendo todos os leads

### Problema
Na funcao `fetchData()` do arquivo `src/pages/Leads.tsx` (linha 217), a query de leads busca **todos os leads** da conta sem nenhum filtro por `assigned_broker_id`. O sistema de permissoes (`leads.view_own` vs `leads.view_all`) existe na interface de configuracao, mas nunca e aplicado na query real de dados.

### Causa raiz
A query atual:
```typescript
const { data: leadsData } = await supabase
  .from('leads')
  .select('...')
  .order('created_at', { ascending: false });
```
Nao possui nenhum `.eq('assigned_broker_id', user.id)` condicional. O RLS filtra apenas por `account_id`, entao todos os usuarios da mesma conta veem todos os leads.

### Solucao

**Arquivo: `src/pages/Leads.tsx`**

Modificar a funcao `fetchData()` para verificar as permissoes do usuario antes de executar a query:

1. Verificar se o usuario tem permissao `leads.view_all` ou e Owner
2. Se **sim** -> manter query atual (sem filtro de broker)
3. Se **nao** (tem apenas `leads.view_own`) -> adicionar `.eq('assigned_broker_id', user.id)` na query

### Detalhes Tecnicos

No bloco de fetch de leads (linha 217), alterar de:

```typescript
const { data: leadsData } = await supabase
  .from('leads')
  .select('...')
  .order('created_at', { ascending: false });
```

Para:

```typescript
let leadsQuery = supabase
  .from('leads')
  .select('...')
  .order('created_at', { ascending: false });

// Se usuario NAO tem permissao de ver todos, filtrar apenas os atribuidos a ele
const canViewAll = hasPermission('leads.view_all') || isOwner;
if (!canViewAll) {
  leadsQuery = leadsQuery.eq('assigned_broker_id', user.id);
}

const { data: leadsData, error: leadsError } = await leadsQuery;
```

Tambem aplicar o mesmo filtro no hook `use-lead-priorities.tsx` que tambem busca leads, e no componente `BrokerRanking.tsx` caso seja relevante.

**Arquivos a editar:**
- `src/pages/Leads.tsx` - Filtro principal na query de leads
- `src/hooks/use-lead-priorities.tsx` - Mesmo filtro para o painel de prioridades (se aplicavel)

**Nota:** O RLS no Supabase ja filtra por `account_id`. Esta mudanca adiciona a camada de filtragem por broker no nivel da aplicacao, respeitando a permissao `leads.view_own` configurada para o papel de Corretor.
