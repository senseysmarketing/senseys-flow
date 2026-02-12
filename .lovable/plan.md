

## Corrigir Recebimento de Mensagens WhatsApp - Diagnostico Final

### Problema 1: Webhook URL possivelmente vazia na Evolution API

Os logs confirmam que para sua instancia `senseys_05f41011_8143_4a71_a3ca_8f42f043ab8c`:
- `send.message` chega (evento de envio)
- `messages.update` chega (status de entrega)
- `messages.upsert` NUNCA chega (mensagens recebidas)

Os toggles estao ON no dashboard, mas a URL do webhook pode estar vazia ou incorreta. O campo de URL fica **acima** dos toggles de eventos na pagina do Evolution API.

**Acao manual imediata (CRITICA):**
1. Na pagina do Evolution API, role para **cima** ate encontrar o campo "Webhook URL"
2. Verifique se esta preenchido com: `https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/whatsapp-webhook`
3. Se estiver vazio ou diferente, preencha com a URL acima
4. Clique em **Save** no canto inferior direito

### Problema 2: Tabelas sem Realtime Publication

As tabelas `whatsapp_messages` e `whatsapp_conversations` nao estao na publicacao `supabase_realtime`. Isso significa que o frontend nao recebe notificacoes quando novas mensagens sao inseridas no banco.

**Correcao: Migracao SQL**

Criar uma migracao para adicionar ambas as tabelas ao Realtime:

```text
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
```

### Problema 3: Falta diagnostico para verificar webhook via API

Adicionar uma acao `check-webhook` no `whatsapp-connect` que chama `webhook/find/{instanceName}` para verificar a configuracao real do webhook (URL, eventos habilitados, status). Isso permite diagnosticar problemas de webhook sem precisar acessar o painel da Evolution API manualmente.

**Arquivo: `supabase/functions/whatsapp-connect/index.ts`**

Adicionar novo case no switch:

```text
case 'check-webhook':
  const findResponse = await fetch(
    `${EVOLUTION_API_URL}/webhook/find/${instanceName}`,
    { headers: { 'apikey': EVOLUTION_API_KEY } }
  )
  const webhookConfig = await findResponse.json()
  console.log('[whatsapp-connect] Current webhook config:', JSON.stringify(webhookConfig))
  return webhookConfig
```

Tambem modificar o case `status` para alem de configurar, tambem verificar o resultado:

```text
// Apos webhook/set, chamar webhook/find para verificar
const verifyResponse = await fetch(
  `${EVOLUTION_API_URL}/webhook/find/${instanceName}`,
  { headers: { 'apikey': EVOLUTION_API_KEY } }
)
const currentConfig = await verifyResponse.json()
console.log('[whatsapp-connect] Webhook verified:', JSON.stringify(currentConfig).substring(0, 500))
```

### Sequencia de Implementacao

1. **Acao manual do usuario (PRIORITARIA)**: Verificar e preencher a URL do webhook no dashboard do Evolution API
2. Criar migracao SQL para Realtime publication
3. Adicionar diagnostico `check-webhook` e verificacao no `status`
4. Deploy das edge functions
5. Testar enviando mensagem do lead

### Resultado Esperado

- Com a URL do webhook correta, `messages.upsert` passara a chegar
- Com Realtime habilitado, a UI atualizara automaticamente
- Com o diagnostico, problemas futuros de webhook serao identificados sem acessar o painel manualmente

