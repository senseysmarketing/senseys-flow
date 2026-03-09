

## Problema: Variavel {imovel} nao sendo substituida nas mensagens automaticas

### Diagnostico

Confirmado no banco: o lead Flavio Lepri tem `property_id` apontando para o imovel ` AP0199-OSWG`, mas a mensagem enviada mostra "sobre o apartamento ," — ou seja, `{imovel}` foi substituido por string vazia.

A query na edge function usa `properties(title)` como join implicito do Supabase PostgREST. Embora o FK exista (`leads_property_id_fkey`) e o service role key seja usado, o join pode falhar silenciosamente (retornando `null` para `properties`) sem causar erro na query. Isso faz com que o `if (lead.properties)` retorne false e o `{imovel}` seja substituido por vazio.

### Solucao

Tornar a busca do imovel mais robusta com duas mudancas:

1. **Usar FK hint explicito**: Trocar `properties(title)` por `properties!leads_property_id_fkey(title)` para evitar qualquer ambiguidade
2. **Adicionar fallback com query direta**: Se `lead.properties` for null mas `lead.property_id` existir, fazer um `SELECT title FROM properties WHERE id = property_id` como segunda tentativa

Tambem corrigir o mesmo problema no `QuickTemplatesPopover.tsx` (frontend), onde `{imovel}` e **sempre** substituido por string vazia porque o componente nao recebe o nome do imovel.

### Arquivos a modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/process-whatsapp-queue/index.ts` | Adicionar FK hint na query + fallback direto para buscar titulo do imovel |
| `src/components/conversations/QuickTemplatesPopover.tsx` | Aceitar prop `propertyName` e usar na substituicao de `{imovel}` |
| `src/components/conversations/ChatView.tsx` | Passar `propertyName` do lead para o `QuickTemplatesPopover` |

### Mudanca principal (edge function)

```typescript
// Antes:
.select('name, phone, email, property_id, assigned_broker_id, properties(title), profiles!leads_assigned_broker_id_fkey(full_name)')

// Depois:
.select('name, phone, email, property_id, assigned_broker_id, properties!leads_property_id_fkey(title), profiles!leads_assigned_broker_id_fkey(full_name)')

// + fallback:
let propertyTitle = (lead.properties as any)?.title || ''
if (!propertyTitle && lead.property_id) {
  const { data: prop } = await supabase
    .from('properties')
    .select('title')
    .eq('id', lead.property_id)
    .single()
  propertyTitle = prop?.title || ''
}
message = message.replace(/{imovel}/gi, propertyTitle.trim())
```

### Mudanca frontend (QuickTemplatesPopover)

Adicionar prop `propertyName` ao componente e usa-la na substituicao em vez de string vazia. O `ChatView` passara `conversation.lead?.properties?.title` para o popover.

