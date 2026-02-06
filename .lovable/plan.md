

## Integração WhatsApp via Evolution API - Plano de Implementação Completo

### Resumo Executivo

Implementar integração completa do WhatsApp no CRM Senseys usando a Evolution API já existente em `https://senseys-evolution.cloudfy.cloud/`. A integração permitira:

1. **Conexao via QR Code** - Cada cliente do CRM conecta seu proprio WhatsApp
2. **Saudacao automatica** - Mensagem enviada quando novo lead entra
3. **Follow-ups programados** - Mensagens agendadas baseadas em regras
4. **Envio via API** - Enviar mensagens diretamente do CRM (sem abrir wa.me)

---

### Fase 1: Infraestrutura (Banco de Dados + Secrets)

#### 1.1 Secret a ser adicionado

| Secret | Valor |
|--------|-------|
| `EVOLUTION_API_URL` | `https://senseys-evolution.cloudfy.cloud` |
| `EVOLUTION_API_KEY` | `3R4MZIGtr4A8tCIDguMsxFU3JURk3B6r` |

#### 1.2 Novas tabelas no banco de dados

```sql
-- Sessoes WhatsApp conectadas por conta
CREATE TABLE whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL UNIQUE,
  phone_number TEXT,
  status TEXT DEFAULT 'disconnected', -- connected, disconnected, connecting, qr_ready
  qr_code TEXT,
  qr_code_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id)
);

-- Regras de automacao de WhatsApp
CREATE TABLE whatsapp_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- 'new_lead', 'status_change', 'time_delay'
  trigger_config JSONB DEFAULT '{}',
  template_id UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  delay_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fila de mensagens para envio
CREATE TABLE whatsapp_message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  template_id UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  automation_rule_id UUID REFERENCES whatsapp_automation_rules(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, processing, sent, failed
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Atualizar whatsapp_message_log para incluir tipo de envio
ALTER TABLE whatsapp_message_log 
ADD COLUMN IF NOT EXISTS send_type TEXT DEFAULT 'manual', -- manual, api, automation
ADD COLUMN IF NOT EXISTS message_id TEXT, -- ID da mensagem na Evolution API
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent'; -- sent, delivered, read, failed
```

#### 1.3 RLS Policies

```sql
-- whatsapp_sessions
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account sessions"
ON whatsapp_sessions FOR SELECT
USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can manage own account sessions"
ON whatsapp_sessions FOR ALL
USING (account_id = public.get_user_account_id());

-- whatsapp_automation_rules
ALTER TABLE whatsapp_automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account rules"
ON whatsapp_automation_rules FOR SELECT
USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can manage own account rules"
ON whatsapp_automation_rules FOR ALL
USING (account_id = public.get_user_account_id());

-- whatsapp_message_queue
ALTER TABLE whatsapp_message_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account queue"
ON whatsapp_message_queue FOR SELECT
USING (account_id = public.get_user_account_id());

CREATE POLICY "Service role can manage queue"
ON whatsapp_message_queue FOR ALL
USING (true);
```

---

### Fase 2: Edge Functions

#### 2.1 `whatsapp-connect` - Gerencia conexao QR Code

**Endpoints:**
- `POST /create-instance` - Cria instancia na Evolution API
- `GET /qr-code` - Retorna QR Code para escanear
- `GET /status` - Verifica status da conexao
- `POST /disconnect` - Desconecta instancia

```text
Fluxo de Conexao:
1. Usuario clica "Conectar WhatsApp"
2. Edge function cria instancia: senseys_{account_id}
3. Solicita QR Code da Evolution API
4. Retorna QR Code em base64 para UI
5. Usuario escaneia com celular
6. Webhook da Evolution notifica conexao
7. UI atualiza para "Conectado"
```

#### 2.2 `whatsapp-send` - Envia mensagens

**Endpoints:**
- `POST /send` - Envia mensagem para numero especifico

```json
{
  "lead_id": "uuid",
  "phone": "5511999999999",
  "message": "Ola {nome}!",
  "template_id": "uuid (opcional)"
}
```

#### 2.3 `whatsapp-webhook` - Recebe eventos da Evolution

**Eventos tratados:**
- `connection.update` - Conexao/desconexao
- `messages.upsert` - Mensagem enviada/recebida
- `qrcode.updated` - Novo QR Code gerado

#### 2.4 `whatsapp-process-queue` - Cron job para fila

- Executa a cada 1 minuto
- Processa mensagens agendadas
- Tenta reenvio em caso de falha (max 3 tentativas)

---

### Fase 3: Interface do Usuario (Configuracoes)

#### 3.1 Nova aba "WhatsApp" em Configuracoes > Integracoes

Estrutura da interface:

```text
+----------------------------------------------------------+
|  WhatsApp Integration                                      |
+----------------------------------------------------------+
|                                                            |
|  [Conexao]                                                 |
|  +------------------------------------------------------+  |
|  |                                                      |  |
|  |  Status: [●] Desconectado                           |  |
|  |                                                      |  |
|  |  [  Conectar WhatsApp  ]                            |  |
|  |                                                      |  |
|  |  Ao conectar, voce podera enviar mensagens          |  |
|  |  automaticas diretamente do CRM.                    |  |
|  +------------------------------------------------------+  |
|                                                            |
|  [Automacoes]                                              |
|  +------------------------------------------------------+  |
|  |                                                      |  |
|  |  [x] Saudacao automatica para novos leads           |  |
|  |      Template: [Saudacao Padrao        v]           |  |
|  |      Delay: [Imediato v]                            |  |
|  |                                                      |  |
|  |  [ ] Follow-up para leads sem resposta              |  |
|  |      Apos: [3 dias v]  Template: [Segundo Contato v]|  |
|  |                                                      |  |
|  |  [+ Adicionar regra de automacao]                   |  |
|  +------------------------------------------------------+  |
|                                                            |
+----------------------------------------------------------+
```

#### 3.2 Modal de QR Code

```text
+------------------------------------------+
|  Conectar WhatsApp                    [X] |
+------------------------------------------+
|                                          |
|  1. Abra o WhatsApp no seu celular       |
|  2. Va em Configuracoes > Aparelhos      |
|     conectados > Conectar aparelho       |
|  3. Escaneie o codigo QR abaixo          |
|                                          |
|       +------------------------+          |
|       |                        |          |
|       |     [QR CODE IMAGE]    |          |
|       |                        |          |
|       +------------------------+          |
|                                          |
|  Expira em: 00:45                        |
|                                          |
|  [ Gerar novo QR Code ]                  |
+------------------------------------------+
```

---

### Fase 4: Integracao com Fluxo Existente

#### 4.1 Modificar `webhook-leads/index.ts`

Apos criar o lead, verificar se existe automacao de saudacao ativa:

```typescript
// Apos criar lead e distribuir
if (lead) {
  // Verificar automacao de saudacao
  const { data: autoRule } = await supabase
    .from('whatsapp_automation_rules')
    .select('*, whatsapp_templates(*)')
    .eq('account_id', accountId)
    .eq('trigger_type', 'new_lead')
    .eq('is_active', true)
    .single();

  if (autoRule) {
    // Verificar se WhatsApp esta conectado
    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('status')
      .eq('account_id', accountId)
      .eq('status', 'connected')
      .single();

    if (session) {
      // Agendar mensagem
      await supabase.from('whatsapp_message_queue').insert({
        account_id: accountId,
        lead_id: lead.id,
        phone: lead.phone,
        message: autoRule.whatsapp_templates.template,
        template_id: autoRule.template_id,
        automation_rule_id: autoRule.id,
        scheduled_for: new Date(Date.now() + autoRule.delay_seconds * 1000)
      });
    }
  }
}
```

#### 4.2 Atualizar `WhatsAppButton.tsx`

Adicionar opcao de envio via API (se conectado):

```typescript
// Verificar se WhatsApp esta conectado
const { data: session } = await supabase
  .from('whatsapp_sessions')
  .select('status')
  .eq('status', 'connected')
  .single();

// Se conectado, enviar via API
if (session?.status === 'connected') {
  await supabase.functions.invoke('whatsapp-send', {
    body: { lead_id, phone, message }
  });
} else {
  // Fallback: abrir wa.me
  window.open(whatsappUrl, '_blank');
}
```

---

### Fase 5: Componentes React

#### 5.1 Novos componentes

| Componente | Descricao |
|------------|-----------|
| `WhatsAppSettings.tsx` | Pagina principal de config WhatsApp |
| `WhatsAppConnectionCard.tsx` | Card de status + botao conectar |
| `WhatsAppQRModal.tsx` | Modal com QR Code |
| `WhatsAppAutomationRules.tsx` | Lista de regras de automacao |
| `WhatsAppAutomationRuleForm.tsx` | Form para criar/editar regra |

#### 5.2 Atualizar Settings.tsx

Adicionar nova aba "WhatsApp" na categoria "Integracoes":

```typescript
{
  title: "Integracoes",
  category: 'integracoes',
  items: [
    { value: 'webhook', label: 'Webhook', icon: <Webhook /> },
    { value: 'whatsapp-integration', label: 'WhatsApp', icon: <MessageCircle /> }, // NOVO
  ]
}
```

---

### Arquitetura Final

```text
+------------------------------------------------------------------+
|                         SENSEYS CRM                               |
+------------------------------------------------------------------+
|                                                                   |
|  [Frontend React]                                                 |
|  +--------------------+  +--------------------+  +-------------+  |
|  | WhatsAppSettings   |  | WhatsAppButton     |  | Leads Page  |  |
|  | (QR Code, Config)  |  | (Envio direto)     |  | (Kanban)    |  |
|  +---------+----------+  +---------+----------+  +------+------+  |
|            |                       |                    |         |
|            v                       v                    v         |
|  +----------------------------------------------------------+    |
|  |                    SUPABASE                               |    |
|  |  +----------------+  +----------------+  +-------------+  |    |
|  |  | Edge Functions |  | Database       |  | Realtime    |  |    |
|  |  | - connect      |  | - sessions     |  | (status)    |  |    |
|  |  | - send         |  | - queue        |  +-------------+  |    |
|  |  | - webhook      |  | - rules        |                   |    |
|  |  | - process-queue|  | - message_log  |                   |    |
|  |  +-------+--------+  +----------------+                   |    |
|  +----------|-----------------------------------------------|    |
|             |                                                     |
+-------------|-----------------------------------------------------+
              |
              v
+------------------------------------------------------------------+
|                     EVOLUTION API                                 |
|                 senseys-evolution.cloudfy.cloud                   |
+------------------------------------------------------------------+
|  +-------------------+  +-------------------+  +---------------+  |
|  | Instance Manager  |  | QR Code Generator |  | Message API   |  |
|  | senseys_{acc_id}  |  | (WebSocket)       |  | (REST)        |  |
|  +-------------------+  +-------------------+  +---------------+  |
+------------------------------------------------------------------+
              |
              v
+------------------------------------------------------------------+
|                        WHATSAPP WEB                               |
|                    (Conta do Cliente)                             |
+------------------------------------------------------------------+
```

---

### Fluxo de Saudacao Automatica

```text
Lead criado (Webhook/Meta/Manual)
         |
         v
+---------------------------+
| Automacao ativada?        |
+------------+--------------+
             | Sim
             v
+---------------------------+
| WhatsApp conectado?       |
+------------+--------------+
             | Sim
             v
+---------------------------+
| Aplica delay (se config)  |
| Adiciona a fila de envio  |
+------------+--------------+
             |
             v
+---------------------------+
| Cron job processa fila    |
| Envia via Evolution API   |
+------------+--------------+
             |
             v
+---------------------------+
| Registra no message_log   |
| Atualiza status na fila   |
+---------------------------+
```

---

### Ordem de Implementacao

| Ordem | Tarefa | Estimativa |
|-------|--------|------------|
| 1 | Adicionar secrets (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`) | 5 min |
| 2 | Criar tabelas no banco + RLS policies | 15 min |
| 3 | Edge function `whatsapp-connect` (criar instancia, QR, status) | 1-2h |
| 4 | Edge function `whatsapp-webhook` (receber eventos) | 30 min |
| 5 | Edge function `whatsapp-send` (enviar mensagens) | 30 min |
| 6 | Componentes UI (WhatsAppSettings, QRModal, etc) | 2-3h |
| 7 | Integrar aba WhatsApp em Settings.tsx | 30 min |
| 8 | Edge function `whatsapp-process-queue` (cron) | 1h |
| 9 | Modificar webhook-leads para saudacao automatica | 30 min |
| 10 | Atualizar WhatsAppButton para envio via API | 30 min |
| 11 | Testes end-to-end | 1h |

**Total estimado: 8-10 horas de desenvolvimento**

---

### Consideracoes Importantes

1. **Multi-Tenancy**: Cada `account_id` tera sua propria instancia na Evolution API com nome unico: `senseys_{account_id}`

2. **Fallback**: Se WhatsApp nao estiver conectado, o sistema continua funcionando abrindo `wa.me` (comportamento atual)

3. **Rate Limiting**: A Evolution API tem limites. Implementar delay minimo de 3s entre mensagens para evitar ban

4. **Webhook URL**: Sera necessario configurar na Evolution API o webhook apontando para:
   `https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/whatsapp-webhook`

5. **Compliance**: Incluir aviso sobre uso responsavel do WhatsApp (nao spam)

---

### Proximos Passos

Ao aprovar este plano, iniciarei pela:
1. Adicao dos secrets
2. Criacao das tabelas no banco
3. Implementacao da primeira edge function (whatsapp-connect)

