
## Correção: Variáveis {form_*} não substituídas em templates do WhatsApp

### Diagnóstico

O problema tem **uma causa raiz** confirmada pelo banco de dados:

Quando um lead chega pelo Meta Webhook (`meta-webhook`), os campos do formulário são salvos em **`lead_custom_field_values`** (ligada à tabela `custom_fields`). Mas quando o `process-whatsapp-queue` vai substituir as variáveis `{form_*}`, ele busca em **`lead_form_field_values`** — uma tabela diferente, que está completamente vazia para esses leads.

Evidência real no banco:
- Lead "Cleide Wanderley" tem em `lead_custom_field_values`:
  - `field_key: você_está_buscando_imóvel_para_moradia_própria_ou_para_investimento?_` → `value: moradia`
- `lead_form_field_values` para esse lead: **zero registros**

### Solução

A correção mais limpa e segura é **dupla**:

**1. `meta-webhook/index.ts`** — Além de salvar em `lead_custom_field_values`, salvar também em `lead_form_field_values` (linhas 216–225). Isso garante que novos leads que chegarem via Meta já tenham seus dados na tabela correta que o processador da fila consulta.

**2. `process-whatsapp-queue/index.ts`** — Como fallback para leads já existentes que só têm dados em `lead_custom_field_values`, adicionar uma segunda busca nessa tabela se `lead_form_field_values` não retornar resultado (linhas 200–226).

### Detalhes Técnicos

**No `meta-webhook`**, após o loop de `lead_custom_field_values`, adicionar inserção paralela em `lead_form_field_values`:

```ts
// NOVO: salvar também em lead_form_field_values para suporte a {form_*} nos templates
for (const [k, v] of Object.entries(fields)) {
  if (EXCLUDED_FIELDS.has(k) || !v) continue;
  await supabase.from("lead_form_field_values").insert({
    lead_id: newLead.id,
    field_name: k,
    field_label: k.replace(/_/g, ' '),
    field_value: v,
  });
}
```

**No `process-whatsapp-queue`**, se `lead_form_field_values` não retornar campos, buscar em `lead_custom_field_values` como fallback:

```ts
// Se nao encontrou em lead_form_field_values, buscar em lead_custom_field_values (legado Meta)
if (!formFields || formFields.length === 0) {
  const { data: customFields } = await supabase
    .from('lead_custom_field_values')
    .select('value, custom_fields(field_key)')
    .eq('lead_id', msg.lead_id)
  
  if (customFields && customFields.length > 0) {
    // match usando field_key como field_name equivalente
    for (const match of formVarMatches) {
      const fieldName = match.slice(6, -1)
      const normalize = (s: string) => s.toLowerCase().replace(/\?/g, '').replace(/_/g, ' ').trim()
      const found = customFields.find(f => 
        normalize((f.custom_fields as any)?.field_key || '') === normalize(fieldName)
      )
      message = message.replace(new RegExp(match.replace(/[{}?]/g, c => `\\${c}`), 'gi'), found?.value || '')
    }
  } else {
    // limpar variaveis nao encontradas
    for (const match of formVarMatches) {
      message = message.replace(new RegExp(match.replace(/[{}?]/g, c => `\\${c}`), 'gi'), '')
    }
  }
}
```

### Arquivos a modificar

1. **`supabase/functions/meta-webhook/index.ts`** — Linhas ~216–225: adicionar inserção duplicada em `lead_form_field_values`
2. **`supabase/functions/process-whatsapp-queue/index.ts`** — Linhas ~208–224: adicionar fallback lookup em `lead_custom_field_values`

### Impacto

- Leads futuros: corrigidos pelo fix no `meta-webhook` (dados salvos em ambas tabelas)
- Leads existentes (como Cleide): corrigidos pelo fallback no `process-whatsapp-queue`
- Nenhuma migração de dados necessária
- Nenhuma tabela existente é alterada
