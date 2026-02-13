

## Corrigir suporte a Push Notifications no Android PWA

### Problema identificado

O usuario Bruno ativa as notificacoes no Desktop (Windows) e o token e salvo. Quando abre o app PWA no Android, o sistema encontra o token do Desktop e marca `isSubscribed = true` globalmente. Resultado: o SmartBanner nao aparece, nenhum token e gerado para o Android, e o dispositivo nunca recebe notificacoes.

### Mudancas necessarias

**1. Arquivo: `src/hooks/use-firebase-messaging.tsx`**

Corrigir a logica de inicializacao para ser **por-dispositivo** em vez de global:

- Na funcao `init()`, ao encontrar um token existente no banco, verificar se esse token pertence ao **dispositivo atual** comparando com um token FCM obtido localmente
- Se a permissao ja estiver `granted` mas nao houver token para este dispositivo, rodar automaticamente o fluxo de subscribe (obter novo token FCM e salvar no banco)
- Adicionar uma flag `isCurrentDeviceSubscribed` que verifica se o token do dispositivo atual esta ativo, em vez de confiar em qualquer token existente
- Na pratica: ao inicializar com permissao `granted`, sempre tentar obter o token FCM via `messaging.getToken()` e comparar com os tokens no banco. Se o token atual nao estiver no banco, salvar automaticamente

Fluxo corrigido:
```text
1. Carregar Firebase SDK e registrar Service Worker
2. Obter token FCM do dispositivo atual via getToken()
3. Verificar se esse token especifico existe no banco
4. Se SIM -> marcar isSubscribed = true
5. Se NAO -> salvar token automaticamente (auto-subscribe para este dispositivo)
```

**2. Arquivo: `public/manifest.webmanifest`**

- Alterar `gcm_sender_id` de `103953800507` para `974602486500` (o messagingSenderId correto do projeto Firebase)
- Este valor errado pode causar falhas silenciosas na entrega de push no Android

**3. Arquivo: `supabase/functions/send-fcm-notification/index.ts`**

- Garantir que todos os valores no objeto `data` do payload FCM sejam strings (requisito da API FCM v1)
- Converter qualquer valor nao-string com `String()` antes de enviar
- Isto evita falhas silenciosas na entrega para dispositivos Android

**4. Arquivo: `src/components/SmartBanner.tsx`**

- Nenhuma mudanca necessaria apos corrigir o hook -- o SmartBanner ja verifica `isSubscribed` corretamente. Com a correcao, `isSubscribed` refletira o estado do dispositivo atual

### Resumo do impacto

- Cada dispositivo (Desktop, Android, iOS) tera seu proprio token FCM registrado independentemente
- O SmartBanner aparecera corretamente em novos dispositivos que ainda nao tem token
- Se o usuario ja concedeu permissao em outro dispositivo, o novo dispositivo fara auto-subscribe silenciosamente (sem precisar clicar no banner)
- Notificacoes serao entregues a todos os dispositivos ativos do usuario

