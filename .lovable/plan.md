

## Corrigir bug critico: tokens de dispositivos diferentes se desativando mutuamente

### Causa raiz identificada

Na query de banco, o Bruno tem:
- Token Android: `is_active: false` (criado 13/02)  
- Token Desktop: `is_active: true` (criado 11/02)

O codigo de "rotacao de token" (linhas 213-228 do `use-firebase-messaging.tsx`) desativa TODOS os tokens FCM ativos do usuario que nao sejam o token atual. Isso significa que quando o Bruno abre no Desktop, desativa o Android. Quando abre no Android, desativa o Desktop. Os dispositivos ficam se sabotando.

### Solucao

---

### Parte 1: Remover logica agressiva de rotacao de tokens

**Arquivo: `src/hooks/use-firebase-messaging.tsx`**

Remover completamente o bloco das linhas 213-228 que desativa tokens de outros dispositivos. A limpeza de tokens invalidos ja e feita corretamente pelo `send-fcm-notification` quando recebe erro `UNREGISTERED` do FCM. A funcao `saveTokenToDatabase` ja faz upsert correto (se o token existe, reativa; se e novo, insere sem desativar outros).

O bloco a ser removido:
```typescript
// REMOVER ESTE BLOCO INTEIRO:
const { data: oldTokens } = await supabase
  .from('push_subscriptions')
  .select('id, endpoint')
  .eq('user_id', user.id)
  .eq('is_active', true)
  .neq('endpoint', currentToken)
  .not('endpoint', 'like', 'https://%');

if (oldTokens && oldTokens.length > 0) {
  for (const old of oldTokens) {
    await supabase.from('push_subscriptions')
      .update({ is_active: false })
      .eq('id', old.id);
  }
  addDiagnosticLog(`${oldTokens.length} token(s) antigo(s) desativado(s) (rotação)`);
}
```

---

### Parte 2: Reativar o token Android do Bruno

**Migracao SQL:**

```sql
UPDATE push_subscriptions 
SET is_active = true 
WHERE user_id = 'f8cf2c28-cae0-453d-90ea-f676280d172f' 
AND is_active = false;
```

Isso reativa o token Android que foi desativado erroneamente.

---

### Parte 3: Adicionar prioridade Android no payload FCM

**Arquivo: `supabase/functions/send-fcm-notification/index.ts`**

Adicionar configuracao `android` no payload para garantir entrega prioritaria no Android:

```typescript
const fcmPayload = {
  message: {
    token: fcmToken,
    notification: { title, body },
    webpush: {
      fcm_options: { link: absoluteUrl },
      notification: {
        icon: "https://crmsenseys.com.br/pwa-192x192.png",
        badge: "https://crmsenseys.com.br/pwa-192x192.png",
      },
    },
    android: {
      priority: "high",
      notification: {
        channel_id: "default",
        priority: "high",
      },
    },
    data: { ... },
  },
};
```

---

### Parte 4: Melhorar recheckSubscription para nao interferir com outros dispositivos

**Arquivo: `src/hooks/use-firebase-messaging.tsx`**

A funcao `recheckSubscription` (linhas 468-493) ja esta correta - apenas salva o token atual sem desativar outros. Nenhuma mudanca necessaria aqui.

---

### Resumo dos arquivos alterados

| Arquivo | Mudanca |
|---|---|
| `src/hooks/use-firebase-messaging.tsx` | Remover bloco de desativacao agressiva de tokens (linhas 213-228) |
| `supabase/functions/send-fcm-notification/index.ts` | Adicionar `android.priority: "high"` no payload FCM |
| Migracao SQL | Reativar token Android do Bruno |

### Resultado esperado

- Cada dispositivo mantem seu proprio token ativo independentemente
- Tokens invalidos sao limpos apenas pelo backend quando FCM retorna UNREGISTERED
- Android recebe notificacoes com prioridade alta
- O diagnostico do Bruno mostrara ambos dispositivos como "Ativo"

