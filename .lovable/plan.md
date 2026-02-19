
## Exibir clientListingId quando imóvel não for encontrado no CRM

### Problema atual

Quando o Grupo OLX envia um lead com `clientListingId` (ex: `a40171`) e esse código não existe como `reference_code` de nenhum imóvel cadastrado no CRM, a informação é simplesmente descartada — o lead é criado sem nenhuma referência ao anúncio de origem.

O usuário não tem como saber de qual imóvel veio o lead.

### Solução

Usar o campo **`anuncio`** (já existente na tabela `leads` e exibido no modal de detalhes) para armazenar o `clientListingId` quando nenhum imóvel for vinculado automaticamente.

Comportamento:
- Se `clientListingId` casa com um `reference_code` → vincula o `property_id` (comportamento atual, mantido)
- Se `clientListingId` existe mas **não casa** com nenhum imóvel → salva `"Cód. OLX: a40171"` no campo `anuncio`
- Se `clientListingId` não existe → nenhuma mudança

Dessa forma, o modal de detalhes do lead exibirá automaticamente o código na seção "Anúncio" da aba "Origem do Lead", sem nenhuma alteração no frontend.

### Onde o código aparecerá

O campo `anuncio` já é exibido no `LeadDetailModal.tsx` (linha 406-414) na seção "Origem do Lead":

```
┌─────────────────────────────────────┐
│  Origem do Lead                     │
│  ┌──────────────┐  ┌─────────────┐  │
│  │ Origem       │  │ Campanha    │  │
│  │ Grupo OLX   │  │ Chat        │  │
│  └──────────────┘  └─────────────┘  │
│  ┌──────────────────────────────┐   │
│  │ 🔗 Anúncio                  │   │
│  │ Cód. OLX: a40171           │   │  ← novo
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Arquivo a modificar

**Apenas 1 arquivo:** `supabase/functions/olx-webhook/index.ts`

Na lógica de normalização do payload (linhas 133-164), quando `clientListingId` existe mas nenhum imóvel é encontrado, adicionar o `anuncio` com o código:

```typescript
// Código atual (linhas 133-149)
let propertyId: string | null = null;
if (body.clientListingId) {
  const { data: matchedProperty } = await supabase
    .from('properties')
    .select('id')
    .eq('account_id', accountId)
    .eq('reference_code', body.clientListingId)
    .single();

  if (matchedProperty) {
    propertyId = matchedProperty.id;
  } else {
    // <-- NADA ACONTECIA AQUI
  }
}
```

```typescript
// Código novo
let propertyId: string | null = null;
let anuncioCode: string | null = null;  // <-- novo
if (body.clientListingId) {
  const { data: matchedProperty } = await supabase
    .from('properties')
    .select('id')
    .eq('account_id', accountId)
    .eq('reference_code', body.clientListingId)
    .single();

  if (matchedProperty) {
    propertyId = matchedProperty.id;
  } else {
    anuncioCode = `Cód. OLX: ${body.clientListingId}`;  // <-- novo
  }
}

// No normalizedPayload:
const normalizedPayload = {
  ...
  anuncio: anuncioCode,  // <-- novo campo
  property_id: propertyId || undefined,
};
```

O `webhook-leads` já aceita e persiste o campo `anuncio` (linha 354 do `webhook-leads/index.ts`): `anuncio: body.anuncio || null`.

### Arquivos a modificar

1. **`supabase/functions/olx-webhook/index.ts`** — adicionar fallback do `clientListingId` no campo `anuncio` quando imóvel não for encontrado
2. **`src/components/OlxIntegrationSettings.tsx`** — atualizar a linha da tabela de mapeamento de `clientListingId` para refletir o novo comportamento (vincula imóvel OU salva código como anúncio)
