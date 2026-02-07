

## Plano: Corrigir Permissões RLS para Fila de Mensagens WhatsApp

### Problema Identificado

O log do console mostra:
```
WhatsApp greeting scheduled for manual lead e92abd87-74ee-4920-bb0c-439bdc97120b
```

**Mas a tabela `whatsapp_message_queue` está vazia!**

O problema está nas políticas RLS:

| Policy | Comando | Quem pode |
|--------|---------|-----------|
| `Service role can manage queue` | ALL | ❌ Apenas service_role |
| `Users can view own account queue` | SELECT | ✅ Usuários podem ver |

**O frontend usa `anon` key**, então o INSERT silenciosamente falha por falta de permissão.

### Solução

Adicionar uma política RLS que permite usuários inserir mensagens na fila da própria conta.

### Mudanças Necessárias

#### 1. Criar nova política RLS via SQL Migration

```sql
-- Permitir usuários inserir na fila da própria conta
CREATE POLICY "Users can insert in own account queue" 
ON public.whatsapp_message_queue 
FOR INSERT 
WITH CHECK (account_id = get_user_account_id());
```

#### 2. Atualizar código para capturar erro (opcional, recomendado)

No arquivo `src/pages/Leads.tsx`, adicionar tratamento de erro após o insert:

```typescript
const { error: queueError } = await supabase.from('whatsapp_message_queue').insert({
  account_id: profile.account_id,
  lead_id: insertedLead.id,
  phone: newLead.phone,
  message: message,
  template_id: automationRule.template_id,
  automation_rule_id: automationRule.id,
  scheduled_for: scheduledFor.toISOString(),
  status: 'pending'
});

if (queueError) {
  console.error('WhatsApp queue insert error:', queueError);
} else {
  console.log(`WhatsApp greeting scheduled for manual lead ${insertedLead.id}`);
}
```

### Fluxo Após Correção

```text
Usuário cria lead manual
        ↓
Insert no banco de dados
        ↓
Verifica regra de automação WhatsApp
        ↓
INSERT em whatsapp_message_queue
        ↓
✅ RLS permite (account_id = própria conta)
        ↓
Mensagem enfileirada
        ↓
Cron job processa e envia
```

### Arquivos Afetados

| Tipo | Arquivo/Ação | Descrição |
|------|--------------|-----------|
| SQL Migration | Nova migration | Adicionar política RLS de INSERT |
| Frontend | `src/pages/Leads.tsx` | Adicionar tratamento de erro |

### Resultado Esperado

- ✅ Leads manuais terão mensagens enfileiradas corretamente
- ✅ Erro será logado se o insert falhar
- ✅ Segurança mantida (usuários só inserem na própria conta)

