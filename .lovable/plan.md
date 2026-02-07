
## Plano: Adicionar Automação WhatsApp para Leads Criados Manualmente

### Problema Identificado

O lead "Teste Gabriel" foi criado **manualmente** pelo formulário de criação na página de Leads. A automação WhatsApp só funciona para:
- ✅ Leads via **webhook** (webhook-leads/index.ts - linha 300-355)
- ✅ Leads via **Meta/Facebook** (meta-webhook/index.ts - linha 177-231)
- ❌ Leads via **criação manual** (Leads.tsx - não implementado!)

A regra de automação configurada tem `trigger_sources: {manual: true, meta: true, webhook: true}`, indicando que a fonte "manual" deveria disparar, mas o código não existe.

### Solução

Adicionar a lógica de automação WhatsApp no frontend quando leads são criados manualmente, similar ao que existe nos webhooks.

### Mudanças Necessárias

#### Arquivo: `src/pages/Leads.tsx`

##### Após a notificação (linha ~319), adicionar lógica de automação WhatsApp:

```typescript
// Check for WhatsApp automation rule (new_lead) for manual source
try {
  const { data: automationRule } = await supabase
    .from('whatsapp_automation_rules')
    .select('*')
    .eq('account_id', profile.account_id)
    .eq('trigger_type', 'new_lead')
    .eq('is_active', true)
    .single();

  if (automationRule) {
    const sources = automationRule.trigger_sources || { manual: true };
    const manualEnabled = typeof sources === 'object' && sources !== null 
      ? (sources as Record<string, boolean>).manual !== false 
      : true;

    if (automationRule.template_id && manualEnabled) {
      // Check if WhatsApp is connected
      const { data: session } = await supabase
        .from('whatsapp_sessions')
        .select('status')
        .eq('account_id', profile.account_id)
        .eq('status', 'connected')
        .single();

      if (session) {
        const scheduledFor = new Date(Date.now() + ((automationRule.delay_seconds || 0) * 1000));
        
        // Get template to compose message
        const { data: template } = await supabase
          .from('whatsapp_templates')
          .select('template')
          .eq('id', automationRule.template_id)
          .single();
        
        if (template) {
          // Replace variables in template
          let message = template.template
            .replace(/{nome}/gi, newLead.name || '')
            .replace(/{telefone}/gi, newLead.phone || '')
            .replace(/{email}/gi, newLead.email || '');
          
          await supabase.from('whatsapp_message_queue').insert({
            account_id: profile.account_id,
            lead_id: insertedLead.id,
            phone: newLead.phone,
            message: message,
            template_id: automationRule.template_id,
            automation_rule_id: automationRule.id,
            scheduled_for: scheduledFor.toISOString(),
            status: 'pending'
          });
          
          console.log(`WhatsApp greeting scheduled for manual lead ${insertedLead.id}`);
        }
      }
    }
  }
} catch (e) {
  console.log('WhatsApp automation check error:', e);
}
```

### Fluxo Após Correção

```text
Usuário cria lead manual
        ↓
Insert no banco de dados
        ↓
Notificação enviada (notify-new-lead)
        ↓
Verifica regra de automação WhatsApp
        ↓
source "manual" habilitado? → Sim
        ↓
WhatsApp conectado? → Sim
        ↓
Enfileira mensagem em whatsapp_message_queue
        ↓
Cron job processa e envia via Evolution API
```

### Detalhes Técnicos

| Item | Valor |
|------|-------|
| Arquivo modificado | `src/pages/Leads.tsx` |
| Local da mudança | Dentro de `handleCreateLead`, após linha 319 |
| Dependências | Nenhuma nova dependência |
| Tabelas acessadas | `whatsapp_automation_rules`, `whatsapp_sessions`, `whatsapp_templates`, `whatsapp_message_queue` |

### Resultado Esperado

Após a correção:
- Leads criados manualmente terão mensagens WhatsApp enfileiradas automaticamente
- O comportamento será idêntico aos leads via webhook e Meta
- A configuração de "manual: true" na regra de automação será respeitada
