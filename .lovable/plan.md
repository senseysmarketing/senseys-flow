

## Plano de Correção do meta-webhook

### Problema Identificado

O edge function `meta-webhook` não está funcionando porque usa um formato de import incompatível com o edge runtime do Supabase:

| Arquivo | Import Usado | Status |
|---------|--------------|--------|
| `meta-webhook/index.ts` | `npm:@supabase/supabase-js@2` | **Quebrado** |
| Todas outras funções | `https://esm.sh/@supabase/supabase-js@2` | Funcionando |

O formato `npm:` não está sendo processado corretamente pelo bundler, fazendo com que a função nunca seja deployada de fato (retorna 404).

---

### Solução

Atualizar o import do Supabase client no `meta-webhook/index.ts` para usar o mesmo formato das outras funções:

```typescript
// Linha 2 - DE:
import { createClient } from "npm:@supabase/supabase-js@2";

// PARA:
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
```

---

### Mudanças no Arquivo

**Arquivo:** `supabase/functions/meta-webhook/index.ts`

**Alteracao na linha 2:**
```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
```

Nenhuma outra alteracao necessaria - a logica da funcao permanece a mesma.

---

### Passos de Implementacao

1. Atualizar o import na linha 2 do arquivo
2. Deploy da funcao atualizada
3. Testar o endpoint com `?test=true`
4. Verificar nos logs que a funcao esta executando

---

### Verificacao Pos-Deploy

Apos o deploy, o endpoint deve retornar:
```json
{
  "status": "Webhook active",
  "verify_token_configured": true,
  "app_secret_configured": true,
  "meta_token": { "exists": true, "user_name": "..." },
  "configured_accounts": [...]
}
```

---

### Impacto

- **Risco:** Baixo (apenas mudanca de import)
- **Tempo estimado:** 5 minutos
- **Resultado esperado:** Leads do Meta/Facebook voltarao a ser recebidos automaticamente

