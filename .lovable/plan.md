
## Correção: Exclusão de Lead Falha por FK em whatsapp_messages e whatsapp_conversations

### Causa Raiz

Ao tentar deletar um lead, o banco bloqueia a operação porque duas tabelas têm chaves estrangeiras com regra `NO ACTION` (sem cascade automático):

| Tabela | Constraint | Regra atual |
|---|---|---|
| `whatsapp_messages` | `whatsapp_messages_lead_id_fkey` | NO ACTION ❌ |
| `whatsapp_conversations` | `whatsapp_conversations_lead_id_fkey` | NO ACTION ❌ |

As demais tabelas relacionadas (lead_activities, lead_custom_field_values, whatsapp_message_queue, etc.) já estão configuradas com `CASCADE` e funcionam corretamente.

### Solução

Duas abordagens, sendo a mais correta é a **opção 1**:

**Opção 1 (Preferida): Adicionar ON DELETE CASCADE nas FKs no banco** — Isso garante que qualquer exclusão de lead (seja via código, SQL direto, ou outras rotinas) automaticamente remove os registros relacionados sem precisar mudar o código da aplicação.

Migration SQL a executar:
```sql
-- Remove as FKs com NO ACTION e recria com CASCADE
ALTER TABLE public.whatsapp_messages
  DROP CONSTRAINT whatsapp_messages_lead_id_fkey,
  ADD CONSTRAINT whatsapp_messages_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_conversations
  DROP CONSTRAINT whatsapp_conversations_lead_id_fkey,
  ADD CONSTRAINT whatsapp_conversations_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;
```

**Nota importante:** Para `whatsapp_messages` e `whatsapp_conversations`, usamos `SET NULL` em vez de `CASCADE` porque essas mensagens/conversas têm valor histórico — ao deletar o lead, as mensagens permanecem no sistema (úteis para auditoria/conversas), mas o vínculo com o lead é removido (`lead_id` fica null). Isso é mais seguro do que apagar todo o histórico de mensagens junto com o lead.

Se a preferência for apagar tudo (mensagens e conversas junto), usar `CASCADE` em vez de `SET NULL`.

**Opção 2 (Código apenas):** Modificar `handleDeleteLead` em `src/pages/Leads.tsx` para deletar manualmente os registros antes de deletar o lead. Menos robusto pois depende de toda chamada de deleção fazer o mesmo.

### Abordagem Escolhida

Usar `SET NULL` (não CASCADE destrutivo) para ambas as tabelas de mensagens:
- `whatsapp_messages.lead_id` → SET NULL ao deletar lead
- `whatsapp_conversations.lead_id` → SET NULL ao deletar lead

Isso preserva o histórico de mensagens (que pode estar vinculado a conversas em andamento) mas desvincula do lead, permitindo a exclusão sem erro.

### Arquivo a modificar

- **Migration SQL** (via ferramenta de migração): alterar as duas constraints de `NO ACTION` para `SET NULL`
- **`src/pages/Leads.tsx`** — nenhuma alteração necessária no código, a migration resolve tudo

### Impacto

- Lead "Leo Henry" e todos os futuros leads poderão ser deletados normalmente
- Histórico de mensagens do WhatsApp é preservado (lead_id fica null, mas mensagens existem)
- Conversas do WhatsApp também preservadas sem vínculo ao lead deletado
- Zero mudança de comportamento para leads ativos
