

## Refatoração do Leads.tsx -- Plano Completo

Este plano aborda os 5 pontos de melhoria + correção do build error, organizados em etapas incrementais.

### Etapa 0: Corrigir build error (main.tsx duplicate attributes)

Reescrever `src/main.tsx` com conteúdo limpo (já tentado antes, persistente por bug do tagger -- será aplicado novamente com whitespace diferente para forçar re-tag).

### Etapa 1: Definir tipos compartilhados (`src/types/leads.ts`)

Criar arquivo centralizado com:
- Interface `Lead` completa (incluindo `meta_campaign_name`, `meta_ad_name`, `assigned_broker_id`, `property_id`, `is_duplicate`, `duplicate_of_lead_id`, `meta_lead_id`, `meta_form_id`, `meta_ad_id`, `meta_campaign_id`)
- Interface `LeadStatus`
- Schema Zod `leadFormSchema` para validação (nome obrigatório, telefone obrigatório)
- Tipo `LeadFormValues` derivado do schema

Isso elimina todos os `as any` e centraliza os tipos.

### Etapa 2: Criar componente `LeadForm.tsx`

Novo arquivo `src/components/leads/LeadForm.tsx`:
- Usa `react-hook-form` + `zod` com o schema da Etapa 1
- Recebe `defaultValues` (para edição) ou vazio (para criação)
- Recebe `statuses`, `canAssignLeads`, `loading`, `onSubmit`, `onCancel`
- Renderiza todos os campos (nome, telefone, email, status, interesse, temperatura, origem, campanha, corretor, imóvel, observações)
- Reutilizado tanto no Create quanto no Edit

### Etapa 3: Extrair diálogos para componentes separados

**`src/components/leads/CreateLeadDialog.tsx`**:
- Recebe `open`, `onOpenChange`, `statuses`, `canAssignLeads`
- Contém toda a lógica de criação (duplicate detection, distribution rules, WhatsApp automation, notify)
- Usa `LeadForm` internamente
- Emite `onSuccess` para refresh

**`src/components/leads/EditLeadDialog.tsx`**:
- Recebe `open`, `onOpenChange`, `lead`, `statuses`, `canAssignLeads`
- Contém lógica de update + Meta CAPI event para hot leads
- Usa `LeadForm` com `defaultValues`
- Emite `onSuccess` para refresh

**`src/components/leads/DeleteLeadDialog.tsx`** (já existe `DisqualifyLeadModal`, mas o AlertDialog de delete está inline):
- Extrair o AlertDialog de confirmação de delete

### Etapa 4: Criar hook `useLeads` com React Query

Novo arquivo `src/hooks/use-leads.ts`:
- `useQuery` para buscar leads + statuses (com cache key `['leads']` e `['lead-statuses']`)
- `useMutation` para `createLead`, `updateLead`, `deleteLead`, `changeStatus`
- Cada mutation faz `queryClient.invalidateQueries(['leads'])` no `onSuccess`
- Remove `useState(loading)`, `useEffect(fetchData)`, `fetchData()` manual do Leads.tsx
- Mantém a lógica de `canViewAll` filter dentro do hook

### Etapa 5: Aplicar `useMemo` nos filtros

No `Leads.tsx` refatorado, envolver `filteredLeads` em `useMemo` com deps `[leads, searchTerm, filters, statuses, viewMode]`. A lógica de filtro atual (linhas 791-869) será movida para dentro do `useMemo`.

### Etapa 6: Simplificar Leads.tsx

Após extrações, o `Leads.tsx` ficará com ~400-500 linhas:
- Imports dos novos componentes e hook
- `useLeads()` para dados
- Estado local apenas para: `viewMode`, `searchTerm`, `filters`, `hiddenColumns`, `notificationsEnabled`, modal open states
- `filteredLeads` via `useMemo`
- JSX: Header + Kanban/Database view + modais importados

### Resumo dos arquivos

| Arquivo | Ação |
|---------|------|
| `src/main.tsx` | Reescrever (fix build) |
| `src/types/leads.ts` | Criar (tipos + schema Zod) |
| `src/hooks/use-leads.ts` | Criar (React Query) |
| `src/components/leads/LeadForm.tsx` | Criar (form compartilhado) |
| `src/components/leads/CreateLeadDialog.tsx` | Criar |
| `src/components/leads/EditLeadDialog.tsx` | Criar |
| `src/components/leads/DeleteLeadDialog.tsx` | Criar |
| `src/pages/Leads.tsx` | Refatorar (~1600 -> ~450 linhas) |
| `src/components/leads/LeadsDatabaseView.tsx` | Atualizar imports de tipos |

### Detalhes Tecnicoss

- Zod schema: `z.object({ name: z.string().min(1), phone: z.string().min(1), email: z.string().email().optional().or(z.literal('')), ... })`
- React Query keys: `['leads', user?.id]`, `['lead-statuses']`
- `staleTime: 30_000` para evitar refetches desnecessarios
- O hook `useLeads` exporta `{ leads, statuses, isLoading, createLead, updateLead, deleteLead, changeStatus }`
- Mutations usam `useMutation` com `onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] })`

