
## Correcao Critica: WhatsApp mostra "Desconectado" mesmo com Evolution API conectado

### Problema Identificado

O sistema depende **exclusivamente** da tabela `whatsapp_sessions` no banco de dados para determinar se o WhatsApp esta conectado. O campo `status` so e atualizado em dois momentos:

1. Quando o webhook recebe um evento `CONNECTION_UPDATE` com `state: open` ou `state: close`
2. Quando o usuario abre a pagina de Configuracoes (acao `status` na edge function `whatsapp-connect`)

**Se o webhook falhar** (timeout, erro de rede, evento perdido) ou se a instancia reconectar automaticamente sem disparar um novo evento, o banco permanece com `status = 'disconnected'` enquanto a Evolution API esta **realmente conectada**. Isso causa:

- Mensagens automaticas marcadas como "failed" com erro "WhatsApp nao conectado"
- Painel da agencia mostrando "Desconectado" incorretamente
- Envios manuais tambem bloqueados

### Solucao

Adicionar uma **verificacao direta com a Evolution API** nos dois pontos criticos antes de desistir e marcar como falha. Se a API confirmar que a instancia esta conectada, atualizar o banco e prosseguir normalmente.

### Alteracoes

**1. Edge Function `supabase/functions/process-whatsapp-queue/index.ts` (linhas 217-238)**

Quando nao encontrar sessao conectada no banco:
- Buscar o `instance_name` da sessao (mesmo desconectada)
- Consultar `GET /instance/connectionState/{instanceName}` na Evolution API
- Se `state === 'open'`: atualizar `whatsapp_sessions.status` para `'connected'` e continuar o envio normalmente
- Se realmente desconectado: manter comportamento atual (marcar como failed)

```typescript
// Buscar sessao independente do status
const { data: session } = await supabase
  .from('whatsapp_sessions')
  .select('status, instance_name')
  .eq('account_id', msg.account_id)
  .maybeSingle()

if (!session) {
  // Nenhuma sessao existe - marcar como failed
  ...
  continue
}

// Se status no banco nao e 'connected', verificar na Evolution API
if (session.status !== 'connected') {
  const apiUrl = EVOLUTION_API_URL.startsWith('http') ? EVOLUTION_API_URL : `https://${EVOLUTION_API_URL}`
  const statusResp = await fetch(
    `${apiUrl}/instance/connectionState/${session.instance_name}`,
    { headers: { 'apikey': EVOLUTION_API_KEY } }
  )
  if (statusResp.ok) {
    const statusData = await statusResp.json()
    if (statusData.instance?.state === 'open') {
      // API conectada! Atualizar banco e continuar
      await supabase.from('whatsapp_sessions')
        .update({ status: 'connected', updated_at: new Date().toISOString() })
        .eq('account_id', msg.account_id)
      console.log('[process-whatsapp-queue] Session was stale - API confirms connected, updated DB')
    } else {
      // Realmente desconectado
      await supabase.from('whatsapp_message_queue')
        .update({ status: 'failed', error_message: 'WhatsApp nao conectado' })
        .eq('id', msg.id)
      errorCount++
      continue
    }
  }
}
```

**2. Edge Function `supabase/functions/whatsapp-send/index.ts` (linhas ~155-170)**

Mesma logica: quando nao encontrar sessao conectada, verificar na Evolution API antes de retornar erro. Se conectada, atualizar DB e prosseguir com o envio.

**3. Adicionar variaveis EVOLUTION_API no `process-whatsapp-queue`**

O `process-whatsapp-queue` ja usa `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` mais abaixo no codigo (linha ~339), entao basta reutilizar no topo do loop.

### Arquivos a editar
- `supabase/functions/process-whatsapp-queue/index.ts` - Verificacao de fallback com Evolution API antes de falhar
- `supabase/functions/whatsapp-send/index.ts` - Mesma verificacao de fallback

### Impacto
Esta mudanca garante que mesmo se um webhook de `CONNECTION_UPDATE` for perdido, o sistema **nunca** marcara mensagens como falhas enquanto a Evolution API estiver realmente conectada. A sincronizacao do status no banco sera feita automaticamente quando detectada a divergencia.
