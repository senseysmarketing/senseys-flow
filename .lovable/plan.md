

## Banner inteligente na parte inferior do sistema

### O que sera feito

Criar um componente `SmartBanner` que aparece como um card flutuante no canto inferior direito da tela (estilo toast/snackbar, similar ao print de referencia do Orbity), com tres cenarios:

1. **Mobile no navegador (nao PWA)**: Banner convidando a instalar o app -- icone de download, texto "Instale o CRM Senseys", botao "Instalar" e botao "Depois". Usa o evento `beforeinstallprompt` para acionar a instalacao nativa.

2. **PWA instalada, notificacoes nao ativas**: Banner convidando a ativar notificacoes -- icone de sino, texto "Ative as Notificacoes Push", botao "Ativar Agora" e botao "Depois". Ao clicar "Ativar Agora", chama `subscribe()` do `useFirebaseMessaging`.

3. **Desktop no navegador, notificacoes nao ativas**: Mesmo banner de notificacoes do cenario 2, ja que no desktop nao faz sentido sugerir instalar PWA, mas e util ativar as notificacoes push diretamente.

Se as notificacoes ja estiverem ativas, nenhum banner aparece.

### Visual

Card flutuante no canto inferior direito com:
- Fundo escuro (`bg-card` com borda)
- Icone a esquerda (sino ou download)
- Titulo em negrito + descricao em texto menor
- Botoes "Ativar Agora"/"Instalar" (primary) e "Depois" (ghost/link)
- Botao X para fechar
- Sombra e bordas arredondadas

### Persistencia

- Ao clicar "Depois" ou X, salva no `localStorage` com timestamp
- Re-exibe apos 7 dias para dar outra chance ao usuario
- Chaves: `smart-banner-dismissed-install` e `smart-banner-dismissed-notifications`

### Detalhes tecnicos

**Novo arquivo: `src/components/SmartBanner.tsx`**

- Usa `useFirebaseMessaging()` para checar `isSubscribed`, `permissionState` e chamar `subscribe()`
- Usa `useIsMobile()` para detectar dispositivo
- Detecta PWA via `window.matchMedia('(display-mode: standalone)')` ou `navigator.standalone`
- Escuta evento `beforeinstallprompt` no `window` para capturar prompt de instalacao (mobile)
- Logica de exibicao:

```text
Se mobile E nao-PWA:
  -> Banner "Instale o App"
Se mobile E PWA E notificacoes inativas:
  -> Banner "Ative Notificacoes"
Se desktop E notificacoes inativas:
  -> Banner "Ative Notificacoes"
Caso contrario:
  -> Nenhum banner
```

- Animacao de entrada (slide-up + fade-in) e saida suave
- Posicao: `fixed bottom-4 right-4 z-50` (nao interfere com BottomNav no mobile, pois estara acima dele com `bottom-20` quando mobile)

**Arquivo modificado: `src/components/Layout.tsx`**

- Importar e renderizar `<SmartBanner />` dentro do container principal, apos o `<BottomNav />`
- Componente se auto-gerencia (so aparece quando relevante e usuario logado)

