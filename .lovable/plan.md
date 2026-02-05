

## Plano: Corrigir Import da Edge Function meta-webhook

### Problema Identificado

A edge function `meta-webhook` não está funcionando porque falta o import da função `serve` do Deno. O código atual usa `serve(async (req) => {...})` na linha 112, mas o import não existe.

**Código atual (linha 1):**
```typescript
import { createClient } from "npm:@supabase/supabase-js@2";
```

**Falta adicionar:**
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
```

### Causa

Na última otimização do arquivo para resolver o timeout de bundle, o import do `serve` foi removido acidentalmente quando o arquivo foi reescrito.

### Solução

Adicionar o import do `serve` na linha 1 do arquivo:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
```

### Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/meta-webhook/index.ts` | Adicionar import do `serve` do Deno |

### Resultado Esperado

Após a correção, a edge function será deployada corretamente e os leads do Meta (Facebook/Instagram) voltarão a ser recebidos automaticamente no CRM.

