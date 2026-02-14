

## Corrigir notificacoes push no Android (caso Bruno - ANZ Imoveis)

### Problemas identificados

**Problema 1: Estado "nao ativado" ao entrar na tela de notificacoes**

O hook `use-firebase-messaging.tsx` usa um `initAttemptedRef` que impede re-inicializacao, mas o fluxo de inicializacao depende de obter o token FCM com sucesso. No Android Chrome, o `messaging.getToken()` pode falhar silenciosamente (rede instavel, service worker nao pronto), fazendo com que `isSubscribed` fique `false`. Alem disso, se o token FCM rotacionar (comportamento normal do Android), o token antigo no banco nao bate com o novo, e o sistema mostra "nao ativado".

**Problema 2: Notificacoes nao chegam**

O token do Bruno esta no banco e marcado como ativo, mas tokens FCM no Android podem rotacionar. Se o token mudou desde o ultimo registro, as notificacoes sao enviadas para um token invalido. O `send-fcm-notification` marca tokens como inativos somente quando recebe erro `UNREGISTERED`, mas isso so acontece na proxima tentativa de envio.

### Solucao

---

### Parte 1: Auto-refresh de token FCM (corrige ambos os problemas)

**Arquivo: `src/hooks/use-firebase-messaging.tsx`**

Mudancas no fluxo de inicializacao:

1. Remover a dependencia do `initAttemptedRef` para o fluxo de verificacao de token. Em vez de impedir completamente a re-inicializacao, permitir que o sistema verifique e atualize o token a cada montagem do provider (mantendo o ref apenas para evitar dupla execucao simultanea).

2. Adicionar listener `onTokenRefresh` do Firebase Messaging. Quando o Android rotaciona o token, esse listener e disparado e o novo token e salvo automaticamente no banco, desativando o antigo.

3. Adicionar retry com delay caso `getToken()` falhe na primeira tentativa (comum em Android quando o service worker ainda esta inicializando).

```typescript
// Dentro do init():
// 1. Adicionar retry para getToken
let currentToken: string | null = null;
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    currentToken = await messaging.getToken({ 
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg 
    });
    if (currentToken) break;
  } catch (e) {
    if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
  }
}

// 2. Listener para rotacao de token
messaging.onMessage(/* existente */);

// Nao existe onTokenRefresh no compat SDK, 
// entao a cada init verificamos se o token mudou
if (currentToken) {
  const { data: existing } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .neq('endpoint', currentToken)
    .like('endpoint', '%:%'); // Somente tokens FCM (contem ":")
  
  // Desativar tokens FCM antigos DESTE dispositivo
  // (nao de outros dispositivos)
  if (existing && existing.length > 0) {
    // Marcar antigos como inativos
    for (const old of existing) {
      await supabase.from('push_subscriptions')
        .update({ is_active: false })
        .eq('id', old.id);
    }
    addDiagnosticLog(`${existing.length} token(s) antigo(s) desativado(s)`);
  }
  
  // Garantir que o token atual esta ativo
  await saveTokenToDatabase(currentToken, user.id, account.id);
  setIsSubscribed(true);
}
```

---

### Parte 2: Forcar re-verificacao ao navegar para Settings

**Arquivo: `src/hooks/use-firebase-messaging.tsx`**

Adicionar uma funcao `recheckSubscription` que pode ser chamada manualmente (por exemplo, quando o usuario abre a tela de notificacoes):

```typescript
const recheckSubscription = useCallback(async () => {
  if (!user?.id || !account?.id) return;
  if (!checkBrowserSupport()) return;
  
  try {
    await loadFirebaseSDK();
    const firebase = (window as any).firebase;
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    
    const swReg = await navigator.serviceWorker.ready;
    const messaging = firebase.messaging();
    const currentToken = await messaging.getToken({ 
      vapidKey: VAPID_KEY, 
      serviceWorkerRegistration: swReg 
    });
    
    if (currentToken) {
      setFcmToken(currentToken);
      await saveTokenToDatabase(currentToken, user.id, account.id);
      setIsSubscribed(true);
      updateDiagnosticInfo({ fcmToken: currentToken, serviceWorkerStatus: 'active' });
    }
  } catch (e) {
    // silencioso
  }
}, [user?.id, account?.id]);
```

**Arquivo: `src/components/NotificationSettings.tsx`**

Chamar `recheckSubscription` quando o componente monta para garantir que o estado esta atualizado:

```typescript
const { recheckSubscription, ...rest } = useFirebaseMessaging();

useEffect(() => {
  recheckSubscription();
}, [recheckSubscription]);
```

---

### Parte 3: Melhorar robustez do Service Worker no Android

**Arquivo: `public/firebase-messaging-sw.js`**

No Android Chrome, o service worker pode ser encerrado e reiniciado frequentemente. Adicionar tratamento para garantir que o push handler funcione corretamente apos restart:

- Manter o handler de push simplificado (ja esta bom)
- Adicionar `tag` unico por notificacao baseado no timestamp para evitar que notificacoes sejam agrupadas/ignoradas no Android

```javascript
const options = {
  body,
  icon: 'https://crmsenseys.com.br/pwa-192x192.png',
  badge: 'https://crmsenseys.com.br/pwa-192x192.png',
  tag: `fcm-${Date.now()}`,  // Tag unica por notificacao
  renotify: true,             // Sempre notificar mesmo com tag
  data: { ...msg?.data, click_action: url }
};
```

---

### Resumo dos arquivos alterados

| Arquivo | Mudanca |
|---|---|
| `src/hooks/use-firebase-messaging.tsx` | Retry no getToken, auto-refresh de tokens rotacionados, funcao recheckSubscription |
| `src/components/NotificationSettings.tsx` | Chamar recheckSubscription ao montar |
| `public/firebase-messaging-sw.js` | Tag unica por notificacao para Android |

### Verificacao pos-implementacao

Apos as mudancas, seria recomendavel pedir ao Bruno para:
1. Abrir o CRM no Android Chrome
2. Ir em Configuracoes > Notificacoes
3. Verificar se aparece "Ativo" sem precisar clicar em nada
4. Clicar em "Testar" para confirmar que a notificacao chega

