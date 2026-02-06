
## Plano de Correção: Variável Duplicada

### Problema Identificado

A Edge Function `whatsapp-connect` está falhando ao iniciar com o erro:
```
SyntaxError: Identifier 'supabaseUrl' has already been declared
```

A variável `supabaseUrl` é declarada duas vezes:

| Linha | Código |
|-------|--------|
| 21 | `const supabaseUrl = Deno.env.get('SUPABASE_URL')!` |
| 65 | `const supabaseUrl = Deno.env.get('SUPABASE_URL')!` (DUPLICADA) |

### Solução

Remover a declaração duplicada na linha 65, já que a variável já existe no escopo.

### Mudança Necessária

**Arquivo**: `supabase/functions/whatsapp-connect/index.ts`

**Antes (linhas 64-65)**:
```typescript
// Build webhook URL for Evolution API callbacks
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`
```

**Depois**:
```typescript
// Build webhook URL for Evolution API callbacks
const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`
```

### Impacto

- **Risco**: Nenhum - a variável `supabaseUrl` já está disponível no escopo
- **Tempo estimado**: 1 minuto
- **Resultado**: Edge Function voltará a funcionar normalmente
