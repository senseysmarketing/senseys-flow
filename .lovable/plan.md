

## Melhorar secao de Diagnostico de Notificacoes

### Mudancas

**Arquivo: `src/components/NotificationSettings.tsx`**

1. **Renomear titulo**: "Diagnostico Firebase" -> "Diagnostico de Notificacoes", e atualizar descricao para algo mais amigavel como "Status dos seus dispositivos e conexoes"

2. **Nova secao "Dispositivos Conectados"**: Antes da tabela de diagnostico tecnico, adicionar uma secao que busca todos os registros da tabela `push_subscriptions` do usuario atual, mostrando:
   - Lista de dispositivos com nome (campo `device_name`, parseado para exibir tipo: Desktop, Android, iOS)
   - Badge de status: "Ativo" (verde) se `is_active = true`, "Desconectado" (vermelho) se `is_active = false`
   - Icone por tipo de dispositivo (Monitor para desktop, Smartphone para mobile)
   - Tempo desde a ultima notificacao: buscar o registro mais recente da tabela existente ou usar o campo `created_at` da subscription como referencia

3. **Query Supabase**: Fazer um `useEffect` + `useState` para buscar `push_subscriptions` do usuario logado, ordenadas por `created_at desc`. Parsear o `device_name` (que contem o user-agent) para detectar o tipo de dispositivo (verificar se contem "iPhone"/"iPad" -> iOS, "Android" -> Android, caso contrario -> Desktop).

4. **Layout da secao de dispositivos**: Cards compactos em lista vertical, cada um com:
   - Icone do tipo de dispositivo
   - Nome curto do dispositivo (ex: "Chrome - Desktop", "Safari - iPhone")
   - Badge ativo/desconectado
   - Data de registro

A tabela de diagnostico tecnico existente (iOS, PWA, Token, etc.) permanece abaixo, mantendo as informacoes de debug para quem precisar.

