
## Painel da Agencia: Trocar colunas e adicionar status WhatsApp

### Resumo
Remover as colunas "Usuarios" e "Imoveis" da tabela e dos cards de totais. Adicionar duas novas colunas: "WhatsApp" (status de conexao) e "Ultima Msg" (data da ultima mensagem enviada com sucesso).

### Alteracoes

**1. Edge Function `supabase/functions/agency-admin-data/index.ts`**

- Remover queries de `userCount` e `propertyCount` (linhas 83-98)
- Adicionar query na tabela `whatsapp_sessions` para verificar se a conta tem sessao com `status = 'connected'`:
```
const { data: whatsappSession } = await adminClient
  .from('whatsapp_sessions')
  .select('status, phone_number')
  .eq('account_id', account.id)
  .single();
```
- Adicionar query na tabela `whatsapp_message_queue` para buscar a ultima mensagem enviada com sucesso (`status = 'sent'`):
```
const { data: lastMessage } = await adminClient
  .from('whatsapp_message_queue')
  .select('sent_at')
  .eq('account_id', account.id)
  .eq('status', 'sent')
  .order('sent_at', { ascending: false })
  .limit(1)
  .single();
```
- Retornar `whatsapp_connected` (boolean), `whatsapp_phone` (string|null) e `last_message_sent_at` (string|null) em vez de `user_count` e `property_count`
- Atualizar `totals`: remover `total_users` e `total_properties`, adicionar `whatsapp_connected_count`

**2. Frontend `src/pages/AgencyAdmin.tsx`**

- Atualizar interface `AccountData`: remover `user_count` e `property_count`, adicionar `whatsapp_connected`, `whatsapp_phone` e `last_message_sent_at`
- Atualizar interface `AgencyData.totals`: remover `total_users` e `total_properties`, adicionar `whatsapp_connected_count`
- Remover os cards de "Usuarios" e "Imoveis" dos stats (reduzir grid de 7 para 5 colunas)
- Adicionar card de "WhatsApp Conectados" com icone verde
- Na tabela, substituir colunas:
  - Remover "Usuarios" e "Imoveis"
  - Adicionar "WhatsApp" com badge verde "Conectado" ou vermelho "Desconectado"
  - Adicionar "Ultima Msg" mostrando data relativa (ex: "ha 2 horas") ou "—" se WhatsApp desconectado
- Importar icone `MessageSquare` ou `Smartphone` do lucide-react para o card e colunas
