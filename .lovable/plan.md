
## Ajuste para parar o “refresh” da aba WhatsApp ao voltar para a aba do navegador

### Diagnóstico
- O problema não parece ser o webhook.
- Também não há polling contínuo normal da tela de WhatsApp; o único `setInterval` encontrado roda apenas enquanto o modal do QR Code está aberto.
- A causa mais provável é o ciclo de autenticação:
  - `use-auth.tsx` ainda atualiza estado em `onAuthStateChange`
  - ao voltar para a aba do navegador, o Supabase pode disparar refresh de sessão
  - isso troca referências de `user/session`
  - `WhatsAppIntegrationSettings.tsx` reage a isso e executa `loadData()` completo
  - como esse load faz `setLoading(true)`, a aba “pisca”, volta spinner e parece um reload

### O que ajustar

#### 1. Blindar o auth para não disparar re-render forte por refresh de token
**Arquivo:** `src/hooks/use-auth.tsx`

- Manter a proteção já existente no `visibilitychange`
- Aplicar a mesma lógica no `onAuthStateChange`
- Só atualizar `user` quando o `user.id` realmente mudar
- Evitar recriar `user` em eventos de refresh de sessão

Resultado: voltar para a aba do navegador não deve reinicializar a tela de WhatsApp.

#### 2. Separar “carga inicial” de “checagem de status”
**Arquivo:** `src/components/whatsapp/WhatsAppIntegrationSettings.tsx`

- Fazer o carregamento pesado (templates, regras, follow-ups, sequências, horários) ocorrer só:
  - na primeira entrada real na página
  - ou quando mudar de conta/usuário de verdade
- Remover a dependência do objeto `user` inteiro para esse carregamento
- Usar um identificador estável (`user?.id`) e um controle tipo `hasInitialized` / `lastLoadedUserId`

Resultado: um refresh de auth não executa mais `loadData()` inteiro.

#### 3. Tornar a verificação de conexão silenciosa
**Arquivo:** `src/components/whatsapp/WhatsAppIntegrationSettings.tsx`

- Deixar `fetchSession()`/checagem de status atualizar apenas o bloco de conexão
- Não usar `setLoading(true)` para verificações rotineiras
- Reservar o spinner global só para a primeira carga da página

Resultado: mesmo se houver reconciliação de status do WhatsApp, o usuário não perde o contexto da edição.

### Comportamento esperado após o ajuste
```text
Trocar de aba do navegador e voltar
→ sessão pode ser renovada em segundo plano
→ tela continua aberta
→ modais e formulários permanecem como estavam
→ sem spinner global / sem “reload visual”
```

### Arquivos a ajustar
| Arquivo | Ação |
|---|---|
| `src/hooks/use-auth.tsx` | Evitar atualizar `user`/contexto em refresh de sessão sem troca real de usuário |
| `src/components/whatsapp/WhatsAppIntegrationSettings.tsx` | Rodar carga completa só na entrada real da tela e transformar checks de status em atualização silenciosa |

### Observação técnica
Se existir algum modal com estado local próprio, esse ajuste é o mais importante porque o problema atual não é desmontagem por aba interna, e sim recarga lógica causada por auth/session ao voltar para a aba do navegador.
