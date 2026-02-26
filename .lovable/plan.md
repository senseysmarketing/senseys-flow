

## Forcar Atualizacao Instantanea do Service Worker (PWA)

### Problema
O `vite-plugin-pwa` com `registerType: "autoUpdate"` detecta novas versoes, mas o Workbox por padrao **espera todas as abas serem fechadas** antes de ativar o novo Service Worker. Usuarios que mantem o CRM aberto o dia inteiro (comum em imobiliarias) continuam rodando codigo antigo por horas ou dias apos um deploy.

### Solucao
Adicionar `skipWaiting: true` e `clientsClaim: true` na configuracao do Workbox, forcando o novo Service Worker a assumir o controle imediatamente apos o download, sem esperar o fechamento de abas.

### Alteracoes

**Arquivo: `vite.config.ts`**

Adicionar duas propriedades na secao `workbox`:

```
workbox: {
  skipWaiting: true,       // NOVO - Ativa o SW novo imediatamente
  clientsClaim: true,      // NOVO - Assume controle de todas as abas abertas
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  // ... resto da config existente
}
```

### Detalhes tecnicos
- `skipWaiting`: Faz o novo SW chamar `self.skipWaiting()` automaticamente, pulando o estado "waiting"
- `clientsClaim`: Faz o novo SW chamar `self.clients.claim()`, tomando controle das abas que estavam sendo servidas pelo SW antigo
- Combinado com `registerType: "autoUpdate"` (ja configurado), isso garante que novos deploys sejam aplicados em segundos, sem interacao do usuario
- Nenhuma alteracao necessaria no `firebase-messaging-sw.js` (ele ja tem `skipWaiting` e `clients.claim` proprios)

### Arquivo a editar
- `vite.config.ts` - Adicionar 2 linhas na secao workbox

