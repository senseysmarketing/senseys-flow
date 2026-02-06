
## Plano de Correção da Conexão WhatsApp

### Problema Identificado

A instância WhatsApp é criada sem configurar a URL de webhook, portanto a Evolution API não notifica o CRM quando a conexão é estabelecida. O polling de status funciona, mas depende do estado retornado pela API, que pode ter um delay.

**Evidência nos logs:**
- `whatsapp-connect`: Mostra estado `"connecting"` indefinidamente
- `whatsapp-webhook`: **Nenhum log** (a Evolution API não está enviando eventos)

### Causa Raiz

Na criação da instância (linhas 117-128 do `whatsapp-connect/index.ts`), não é passada a configuração de webhook:

```typescript
body: JSON.stringify({
  instanceName,
  qrcode: true,
  integration: 'WHATSAPP-BAILEYS',
  // ⚠️ Faltam: webhook URL, eventos, etc.
}),
```

### Solução

Adicionar a configuração de webhook na criação da instância para que a Evolution API notifique o CRM quando:
- A conexão for estabelecida (`connection.update`)
- O QR Code for atualizado (`qrcode.updated`)
- Mensagens forem recebidas (`messages.upsert`)

### Mudanças Necessárias

#### Arquivo: `supabase/functions/whatsapp-connect/index.ts`

**Mudança 1**: Obter a URL do webhook (após linha 60)

```typescript
// Obter URL do webhook para configurar na instância
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`
```

**Mudança 2**: Adicionar configuração de webhook no body da criação (linhas 117-128)

```typescript
body: JSON.stringify({
  instanceName,
  qrcode: true,
  integration: 'WHATSAPP-BAILEYS',
  webhook: {
    url: webhookUrl,
    webhook_by_events: false,
    events: [
      'CONNECTION_UPDATE',
      'QRCODE_UPDATED', 
      'MESSAGES_UPSERT',
      'MESSAGES_UPDATE',
      'SEND_MESSAGE'
    ]
  }
}),
```

**Mudança 3**: Adicionar fallback - Configurar webhook em instância existente

Para instâncias que já existem, chamar a API de configuração de webhook:

```typescript
if (alreadyExists) {
  console.log('[whatsapp-connect] Instance already exists, configuring webhook...')
  
  // Configurar webhook na instância existente
  await fetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY,
    },
    body: JSON.stringify({
      url: webhookUrl,
      webhook_by_events: false,
      events: [
        'CONNECTION_UPDATE',
        'QRCODE_UPDATED',
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE'
      ]
    }),
  })
}
```

#### Arquivo: `supabase/functions/whatsapp-webhook/index.ts`

**Mudança**: Tornar a função pública (sem autenticação) para receber webhooks externos

Verificar no `supabase/config.toml` se a função já está configurada com `verify_jwt = false`.

### Resumo das Alterações

| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `supabase/functions/whatsapp-connect/index.ts` | Adicionar configuração de webhook na criação da instância e fallback para instâncias existentes |
| `supabase/config.toml` | Garantir que `whatsapp-webhook` tem `verify_jwt = false` |

### Fluxo Esperado Após Correção

```text
1. Usuário clica "Conectar"
2. Sistema cria instância COM webhook configurado
3. QR Code é exibido
4. Usuário escaneia QR Code
5. Evolution API envia evento CONNECTION_UPDATE para whatsapp-webhook
6. Webhook atualiza status para "connected"
7. Polling detecta mudança e fecha modal
```

### Impacto

- **Risco**: Baixo - adiciona configuração que estava faltando
- **Tempo estimado**: 10 minutos
- **Benefício**: Conexão WhatsApp funcionará corretamente

### Ação Adicional Recomendada

Após implementar a correção, será necessário **desconectar e reconectar** para recriar a instância com as configurações de webhook, ou usar a API de `webhook/set` para configurar a instância existente.
