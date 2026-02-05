

## Plano: Corrigir Headers CORS da Edge Function `generate-support-session`

### Problema Identificado

A edge function `generate-support-session` está com headers CORS incompletos:

```typescript
// Atual - incompleto
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

O Supabase client envia headers adicionais que precisam ser permitidos:
- `x-supabase-client-platform`
- `x-supabase-client-platform-version`
- `x-supabase-client-runtime`
- `x-supabase-client-runtime-version`

### Solução

Atualizar os headers CORS para incluir todos os headers necessários:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}
```

### Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/generate-support-session/index.ts` | Atualizar `corsHeaders` com headers completos |

### Resultado Esperado

Após a correção, o modo suporte funcionará novamente, permitindo que super admins acessem contas de clientes para suporte técnico.

