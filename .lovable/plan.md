
## Plano: Suporte Multi-Dispositivo para Push Notifications

### Problema Identificado

A conta "T&B Negocios Imobiliarios" tem 1 usuario compartilhado entre 2 celulares. O sistema atual **desativa todos os tokens anteriores** quando um novo dispositivo ativa push notifications. Resultado: apenas o ultimo dispositivo que ativou recebe notificacoes.

Evidencia no banco de dados:
- Token iPhone 1: `cz5M...` → `is_active: true`
- Token iPhone 2: `cM_k...` → `is_active: false` (desativado quando o primeiro ativou)

### Causa Raiz

No arquivo `src/hooks/use-firebase-messaging.tsx`, a funcao `saveTokenToDatabase` executa:

```
// Desativa TODOS os tokens do usuario antes de salvar o novo
await supabase
  .from('push_subscriptions')
  .update({ is_active: false })
  .eq('user_id', userId);
```

Isso garante apenas 1 dispositivo ativo por usuario, mas impede multi-dispositivo.

### Solucao

Modificar a logica de salvamento de token para manter **todos os tokens validos ativos** (um por dispositivo), em vez de desativar os anteriores.

### Arquivo a Modificar

**`src/hooks/use-firebase-messaging.tsx`**

### Mudancas

#### 1. Alterar `saveTokenToDatabase` para suporte multi-dispositivo

Em vez de desativar todos os tokens e depois salvar, a nova logica:
- Verificar se o token exato ja existe → se sim, reativar
- Se nao existe, inserir novo (sem desativar os outros)
- Resultado: cada dispositivo mantem seu proprio token ativo

```typescript
const saveTokenToDatabase = async (token: string, userId: string, accountId: string) => {
  // Verificar se este token ja existe para este usuario
  const { data: existing } = await supabase
    .from('push_subscriptions')
    .select('id, is_active')
    .eq('endpoint', token)
    .eq('user_id', userId)
    .single();

  if (existing) {
    // Token ja existe - apenas reativar se inativo
    if (!existing.is_active) {
      await supabase.from('push_subscriptions')
        .update({ is_active: true, device_name: navigator.userAgent.substring(0, 50), account_id: accountId })
        .eq('id', existing.id);
    }
  } else {
    // Novo token (novo dispositivo) - inserir sem desativar os outros
    await supabase.from('push_subscriptions').insert({
      user_id: userId, account_id: accountId, endpoint: token,
      p256dh: 'fcm', auth: 'fcm', is_active: true,
      device_name: navigator.userAgent.substring(0, 50)
    });
  }
};
```

#### 2. Ajustar a checagem de reconexao no init

Na funcao `init` (useEffect), a query busca um unico token ativo com `.single()`. Com multi-dispositivo, pode haver mais de 1 token ativo. Alterar para `.maybeSingle()` ou buscar apenas pelo user agent atual:

```typescript
// Buscar token ativo que corresponda a este dispositivo
const { data: existing } = await supabase
  .from('push_subscriptions')
  .select('endpoint, is_active')
  .eq('user_id', user.id)
  .eq('is_active', true)
  .not('endpoint', 'like', 'https://%')
  .limit(1)
  .maybeSingle();
```

#### 3. Ajustar `unsubscribe` para desativar apenas o token atual

Atualmente desativa pelo token armazenado em state, o que ja esta correto. Nenhuma mudanca necessaria.

#### 4. Reativar o token desativado do segundo dispositivo

Executar um UPDATE direto no banco para reativar o token desativado da conta T&B:

```sql
UPDATE push_subscriptions SET is_active = true 
WHERE id = 'a198222c-afb5-4fe5-88be-42574c8bdacb';
```

Isso reativara imediatamente o segundo iPhone sem que o usuario precise reconfigurar.

### Resultado

- Ambos os celulares do "Thiago e Belisa" receberao push notifications
- Cada dispositivo mantem seu proprio token FCM ativo
- O `send-fcm-notification` ja envia para todos os tokens ativos do usuario, entao nao precisa de mudanca no backend
- A funcao de teste tambem enviara para todos os dispositivos
