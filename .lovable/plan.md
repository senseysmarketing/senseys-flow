
## Correcao: Webhook da instancia nao recebe mensagens

### Problema identificado

As mensagens do Leo Henry **nao estao chegando ao nosso webhook** porque a Evolution API nao esta enviando eventos para a instancia `senseys_05f41011_8143_4a71_a3ca_8f42f043ab8c`. 

Confirmacoes:
- **0 mensagens recebidas** no banco de dados para este contato (apenas 6 enviadas)
- **0 logs do webhook** para esta instancia (enquanto outras 3 instancias funcionam normalmente)
- **0 chamadas a `whatsapp-connect`** nos logs recentes, indicando que o erro 401 impediu qualquer reconfiguacao

### Causa raiz

A edge function `whatsapp-connect` exige autenticacao (verifica o header `Authorization`). Quando a sessao do usuario expira:
1. O frontend chama `whatsapp-connect?action=status`
2. A funcao retorna 401
3. A correcao anterior apenas silenciou o erro no frontend (fez `return`)
4. O webhook **nunca e reconfigurado** na Evolution API
5. Resultado: mensagens recebidas nunca chegam ao sistema

### Plano de correcao

**1. Tornar a acao `status` mais resiliente no frontend**

Quando o status check falha por 401, tentar renovar a sessao automaticamente e re-executar a chamada. Se nao conseguir, exibir um alerta visual claro pedindo re-login.

**2. Adicionar um endpoint de health-check/reconfigure sem autenticacao**

Criar uma acao `reconfigure-webhook` na edge function `whatsapp-connect` que nao exija JWT do usuario, mas valide via um token interno ou pela propria chave da Evolution API. Isso permite que o sistema reconfigure o webhook independentemente do estado de login do usuario.

Alternativa mais simples: **mover a logica de reconfigurar webhook para a edge function `whatsapp-webhook`**. Quando o webhook recebe um `connection.update` com estado `open`, ele ja pode reconfigurar a si mesmo (ja que a webhook function nao exige JWT).

**3. Solucao imediata: forcar reconfiguacao agora**

Adicionar na edge function `whatsapp-connect` uma acao `force-reconfigure` que aceita o `account_id` como parametro e valida via service role key, sem necessidade de sessao do usuario. Tambem expor um botao de "Diagnosticar Webhook" na tela de configuracoes.

### Secao tecnica

**Arquivo: `supabase/functions/whatsapp-connect/index.ts`**

Adicionar uma acao `force-reconfigure` que funcione sem autenticacao do usuario, usando uma verificacao alternativa (ex: API key interna ou permitindo que a propria funcao se auto-reconfigure quando detecta a instancia):

```typescript
// Antes do switch, adicionar caso especial para force-reconfigure
// que nao precisa de auth do usuario
case 'force-reconfigure': {
  // Aceitar account_id como parametro de query
  const targetAccountId = url.searchParams.get('account_id')
  if (!targetAccountId) {
    return new Response(JSON.stringify({ error: 'account_id required' }), { status: 400, headers: corsHeaders })
  }
  
  const targetInstance = `senseys_${targetAccountId.replace(/-/g, '_')}`
  
  // Verificar se instancia existe e esta conectada
  const statusResp = await fetch(
    `${EVOLUTION_API_URL}/instance/connectionState/${targetInstance}`,
    { headers: { 'apikey': EVOLUTION_API_KEY } }
  )
  
  if (statusResp.ok) {
    const statusData = await statusResp.json()
    if (statusData.instance?.state === 'open') {
      // Reconfigurar webhook
      await fetch(`${EVOLUTION_API_URL}/webhook/set/${targetInstance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            webhook_by_events: false,
            events: ['CONNECTION_UPDATE','QRCODE_UPDATED','MESSAGES_UPSERT','MESSAGES_UPDATE','SEND_MESSAGE']
          }
        }),
      })
      
      return new Response(JSON.stringify({ success: true, message: 'Webhook reconfigured' }), { headers: corsHeaders })
    }
  }
  
  return new Response(JSON.stringify({ error: 'Instance not connected' }), { status: 400, headers: corsHeaders })
}
```

Para que esta acao funcione sem JWT, mover o check de autenticacao para DEPOIS do parse da action, e apenas exigir auth nas acoes que necessitam:

```typescript
// Extrair action antes do auth check
const url = new URL(req.url)
const action = url.searchParams.get('action') || 'status'

// Acoes que nao precisam de auth
if (action === 'force-reconfigure') {
  // ... logica sem auth
}

// Auth check para todas as outras acoes
const authHeader = req.headers.get('Authorization')
if (!authHeader) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
}
```

**Arquivo: `src/components/whatsapp/WhatsAppIntegrationSettings.tsx`**

Adicionar um botao "Reconfigurar Webhook" visivel quando conectado e melhorar o tratamento do 401:

```typescript
// Quando status check falha com 401, tentar refresh da sessao
if (response.error) {
  console.log('Error checking WhatsApp status, trying session refresh:', response.error);
  const { error: refreshError } = await supabase.auth.refreshSession();
  if (!refreshError) {
    // Retry after refresh
    const retryResponse = await supabase.functions.invoke('whatsapp-connect?action=status');
    if (!retryResponse.error) {
      // processar normalmente
    }
  } else {
    toast({
      title: "Sessao expirada",
      description: "Faca login novamente para reconfigurar o WhatsApp.",
      variant: "destructive"
    });
  }
  return;
}
```

Adicionar botao de diagnostico que chama `force-reconfigure`:

```typescript
const handleForceReconfigure = async () => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id')
    .single();
  
  if (profile?.account_id) {
    const response = await supabase.functions.invoke(
      `whatsapp-connect?action=force-reconfigure&account_id=${profile.account_id}`
    );
    if (response.data?.success) {
      toast({ title: "Webhook reconfigurado!", description: "As mensagens devem comecar a chegar em instantes." });
    }
  }
};
```

### Resultado esperado

1. A acao `force-reconfigure` permite reconfigurar o webhook sem depender de sessao de usuario
2. O botao de diagnostico da uma solucao rapida quando o webhook se desconfigura
3. O auto-refresh de sessao no frontend reduz a chance de falhas silenciosas
4. As mensagens do Leo Henry e de todos os outros contatos passarao a chegar normalmente apos a reconfiguacao
