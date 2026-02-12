

## Correcao: Mensagens do WhatsApp Web nao aparecem + instancia sem eventos

### Diagnostico

1. **Webhook configurado corretamente** - URL, eventos e status estao OK na Evolution API
2. **Zero eventos recebidos** - Mesmo apos reconfigurar o webhook multiplas vezes, a Evolution API nao esta chamando o webhook para a instancia `senseys_05f41011_8143_4a71_a3ca_8f42f043ab8c` (outras instancias funcionam normalmente)
3. **Evento SEND_MESSAGE sem handler** - O webhook registra o evento `SEND_MESSAGE`, mas o codigo nao tem um handler para `send.message` no switch

### Causa raiz

Dois problemas:

1. **Instancia "travada"** - A Evolution API pode ter um bug onde a configuracao de webhook e salva mas nao e aplicada na instancia ativa. Solucao: reiniciar a instancia via API (`/instance/restart`)
2. **Evento `send.message` nao processado** - Mensagens enviadas pela API (nao pelo WhatsApp Web) chegam como `SEND_MESSAGE` mas o webhook ignora esse evento. Mensagens do WhatsApp Web chegam como `MESSAGES_UPSERT` com `fromMe: true`, que ja e tratado corretamente

### Plano de correcao

**1. Adicionar handler para `send.message` no webhook**

No arquivo `supabase/functions/whatsapp-webhook/index.ts`, adicionar o case `send.message` no switch (linha 438) para rotear ao mesmo handler de `messages.upsert`:

```typescript
case 'send.message':
  console.log('[whatsapp-webhook] send.message payload keys:', JSON.stringify(Object.keys(data || {})))
  await handleMessagesUpsert(supabase, session, data)
  break
```

**2. Adicionar acao `restart-instance` na edge function `whatsapp-connect`**

Para forcar a Evolution API a reaplicar a configuracao do webhook, adicionar uma acao que reinicia a instancia:

```typescript
case 'restart-instance': {
  // Chamar /instance/restart da Evolution API
  const restartResp = await fetch(
    `${EVOLUTION_API_URL}/instance/restart/${instanceName}`,
    { method: 'PUT', headers: { 'apikey': EVOLUTION_API_KEY } }
  )
  const restartData = await restartResp.json()
  
  // Aguardar reconexao e reconfigurar webhook
  await new Promise(resolve => setTimeout(resolve, 3000))
  await configureWebhook(instanceName, webhookUrl)
  
  return new Response(JSON.stringify({ 
    success: true, message: 'Instance restarted and webhook reconfigured' 
  }), { headers: corsHeaders })
}
```

**3. Adicionar botao "Reiniciar Instancia" na UI de configuracoes**

No arquivo `src/components/whatsapp/WhatsAppIntegrationSettings.tsx`, adicionar um botao ao lado do "Reconfigurar Webhook" que chama a nova acao `restart-instance`. Isso permite resolver o problema de instancias travadas sem precisar desconectar e reconectar o QR Code.

**4. Executar restart imediatamente apos deploy**

Apos deployar as funcoes, chamar `restart-instance` para forcar a reconexao e finalmente receber os eventos pendentes.

### Secao tecnica

**Arquivo: `supabase/functions/whatsapp-webhook/index.ts`**

Adicionar case no switch (apos linha 437):
```typescript
case 'send.message':
  console.log('[whatsapp-webhook] send.message payload keys:', JSON.stringify(Object.keys(data || {})))
  await handleMessagesUpsert(supabase, session, data)
  break
```

**Arquivo: `supabase/functions/whatsapp-connect/index.ts`**

Dentro do bloco de acoes nao autenticadas (apos o `force-reconfigure`, antes do auth check), adicionar:
```typescript
if (action === 'restart-instance') {
  const targetAccountId = url.searchParams.get('account_id')
  if (!targetAccountId) {
    return new Response(JSON.stringify({ error: 'account_id required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
  
  const { data: accountExists } = await supabase
    .from('accounts').select('id').eq('id', targetAccountId).maybeSingle()
  if (!accountExists) {
    return new Response(JSON.stringify({ error: 'Invalid account_id' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
  
  const targetInstance = `senseys_${targetAccountId.replace(/-/g, '_')}`
  
  try {
    const restartResp = await fetch(
      `${EVOLUTION_API_URL}/instance/restart/${targetInstance}`,
      { method: 'PUT', headers: { 'apikey': EVOLUTION_API_KEY } }
    )
    const restartData = await restartResp.json()
    console.log('[whatsapp-connect] Restart result:', JSON.stringify(restartData))
    
    // Aguardar reconexao
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Reconfigurar webhook
    const webhookData = await configureWebhook(targetInstance, webhookUrl)
    
    return new Response(JSON.stringify({ 
      success: true, message: 'Instance restarted', restart: restartData, webhook: webhookData
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}
```

**Arquivo: `src/components/whatsapp/WhatsAppIntegrationSettings.tsx`**

Adicionar funcao e botao para reiniciar instancia:
```typescript
const handleRestartInstance = async () => {
  setReconfiguring(true) // reutilizar estado existente
  try {
    const { data: profile } = await supabase.from('profiles').select('account_id').single()
    if (profile?.account_id) {
      const response = await supabase.functions.invoke(
        `whatsapp-connect?action=restart-instance&account_id=${profile.account_id}`
      )
      if (response.data?.success) {
        toast({ title: "Instancia reiniciada!", description: "O webhook foi reconfigurado. Mensagens devem chegar em instantes." })
      } else {
        toast({ title: "Erro", description: response.data?.error || "Falha ao reiniciar", variant: "destructive" })
      }
    }
  } finally { setReconfiguring(false) }
}
```

### Resultado esperado

1. O restart da instancia forca a Evolution API a reconectar e reaplicar o webhook
2. Mensagens enviadas pelo WhatsApp Web passam a ser capturadas via `MESSAGES_UPSERT` (fromMe=true)
3. Mensagens enviadas pela API passam a ser capturadas via `SEND_MESSAGE`
4. O botao "Reiniciar Instancia" oferece auto-reparo quando eventos param de chegar
