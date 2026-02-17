
## Corrigir follow-up enviado mesmo com lead já tendo respondido (@lid)

### Diagnóstico confirmado

A Raquel Rosselli respondeu via WhatsApp Business com o JID `276175070957762@lid`. Este é um formato especial de identificador (@lid) que o WhatsApp usa em algumas situações. O webhook recebeu a mensagem mas não conseguiu resolver o @lid para o telefone real da Raquel (`5512996165317`), pois a conversa principal não tinha o campo `lid_jid` preenchido.

Resultado:
- A mensagem da Raquel foi salva com `phone = 276175070957762` e `lead_id = null`
- Quando o `process-whatsapp-queue` verificou se o lead havia respondido, buscou mensagens recebidas pelo sufixo do telefone (`%996165317%`), não encontrou nada, e disparou o follow-up

### Dois bugs a corrigir

**Bug 1 — Proteção do follow-up fraca** (`process-whatsapp-queue/index.ts`):
A verificação atual busca por `phone ilike '%{sufixo}%'`, mas isso falha quando a resposta chegou via @lid. A proteção precisa ser reforçada para também buscar pelo `lead_id` diretamente na tabela `whatsapp_messages`.

**Bug 2 — @lid não conectado à conversa existente** (`whatsapp-webhook/index.ts`):
Quando uma resposta chega via @lid e o webhook não consegue resolver para um telefone, o sistema deveria tentar casar com uma conversa existente pelo `lead_id` (via nome ou telefone do lead no banco). Além disso, deve salvar o `lid_jid` na conversa para futuras resoluções.

### Correções

**1. `supabase/functions/process-whatsapp-queue/index.ts`**

Tornar a verificação de resposta do lead **dupla**:
- Verificação atual (por telefone) — mantida
- **Nova verificação por `lead_id`**: buscar em `whatsapp_messages` qualquer mensagem com `lead_id = msg.lead_id` E `is_from_me = false`

Isso garante que mesmo que a mensagem tenha chegado via @lid (com telefone diferente), se o `lead_id` foi corretamente associado, o follow-up será cancelado.

```
-- Pseudocódigo da nova verificação dupla:
SE (mensagens com phone sufixo) OU (mensagens com lead_id AND is_from_me=false)
  -> Cancelar follow-up
```

**2. `supabase/functions/whatsapp-webhook/index.ts`**

Melhorar a resolução de @lid para associar ao lead correto quando o webhook recebe uma mensagem via @lid:

- Ao processar mensagem @lid que não resolve para telefone, tentar buscar o lead pelo `pushName` (nome do contato) na conta
- Se encontrar o lead, associar o `lead_id` à mensagem e salvar o `lid_jid` na conversa existente para resolver futuras mensagens
- Cancelar follow-ups pendentes quando uma mensagem @lid for associada a um lead, independente do telefone

**3. Cancelamento do follow-up ainda `pending` para Raquel**

Há 2 follow-ups ainda `pending` na fila para Raquel (`d503b14e` e `1aec864c`). Como parte da correção, esses devem ser cancelados via SQL direto pois ela já respondeu.

### Arquivos a modificar

1. **`supabase/functions/process-whatsapp-queue/index.ts`**
   - Adicionar verificação secundária por `lead_id` na tabela `whatsapp_messages` (`is_from_me = false`)
   - Se encontrar qualquer mensagem recebida do lead (independente de como veio), cancelar o follow-up

2. **`supabase/functions/whatsapp-webhook/index.ts`**
   - Na seção de cancelamento de follow-ups (linha ~455), também cancelar quando a mensagem chegou via @lid mas o `lead_id` foi resolvido pelo nome
   - Quando um @lid é associado a um lead, salvar o `lid_jid` na conversa existente do lead para resolver futuras mensagens automaticamente

3. **Migração de dados** (SQL executado como parte do deploy):
   - Cancelar os 2 follow-ups pendentes da Raquel
   - Atualizar a mensagem `@lid` com o `lead_id` correto da Raquel

### Fluxo corrigido

```text
Lead responde via @lid
        |
Webhook recebe @lid, tenta resolver via API
        |
Não resolve? -> Busca lead pelo pushName no banco
        |
Encontra lead -> Associa lead_id + salva lid_jid na conversa
        |
Cancela follow-ups pendentes do lead_id
        |
process-whatsapp-queue roda a cada minuto:
  Verificação 1: phone sufixo -> não encontra (ainda @lid)
  Verificação 2: lead_id + is_from_me=false -> ENCONTRA
        |
Follow-up cancelado corretamente
```
