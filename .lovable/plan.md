

## Correcao: Mensagens Duplicadas na Fila Legada (whatsapp_message_queue)

### Causa Raiz Confirmada

O problema **nao esta** no novo sistema de automacao (`whatsapp_automation_control`) -- esse funciona corretamente com lock otimista.

O problema esta na **fila legada** (`whatsapp_message_queue`) que ainda processa leads criados antes da migracao. Os dados confirmam:

- Walter Costa tem **2 entradas** na fila legada (template 1 + template 2), ambas com `scheduled_for: 2026-03-02 11:00:00`
- O `message_log` mostra **4 envios** (cada template enviado 2x)
- Os timestamps sao separados por apenas **124ms** (`11:01:09.442` vs `11:01:09.566`)
- Isso significa que o **cron disparou 2 execucoes simultaneas** do worker

O codigo legado na linha 698-704 faz `SELECT status WHERE id = X` antes de enviar. Duas execucoes simultaneas leem `status = 'pending'` ao mesmo tempo, e ambas procedem com o envio. E a mesma corrida de condicao que o lock otimista resolve no sistema novo, mas que nunca foi aplicada ao codigo legado.

**8 leads afetados** na conta Senseys, todos com exatamente o mesmo padrao: cada mensagem enviada 2x.

---

### Solucao

Aplicar **lock otimista** na fila legada, identico ao padrao do automation_control:

**Arquivo: `supabase/functions/process-whatsapp-queue/index.ts`**

Substituir o padrao atual (linhas 697-707):
```typescript
// ANTES (race condition):
const { data: freshMsg } = await supabase
  .from('whatsapp_message_queue')
  .select('status')
  .eq('id', msg.id)
  .single()

if (freshMsg?.status !== 'pending') {
  continue
}
```

Por lock otimista atomico:
```typescript
// DEPOIS (atomico):
const { data: locked, error: lockErr } = await supabase
  .from('whatsapp_message_queue')
  .update({ status: 'processing' })
  .eq('id', msg.id)
  .eq('status', 'pending')
  .select('id')
  .maybeSingle()

if (lockErr || !locked) {
  console.log(`[process-whatsapp-queue] Message ${msg.id} already picked up, skipping`)
  continue
}
```

E ajustar o status final de `sent` para usar `.eq('status', 'processing')` ao inves de `.eq('id', msg.id)` simples.

Tambem adicionar recuperacao de registros "stuck" (status `processing` ha mais de 5 minutos) no inicio do bloco legado, identico ao que ja existe no automation_control.

---

### Arquivos a editar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/process-whatsapp-queue/index.ts` | Lock otimista na fila legada + recuperacao de stuck |

### Resultado esperado

- Zero duplicatas futuras mesmo com cron disparando execucoes simultaneas
- Compativel com o periodo de transicao enquanto a fila legada ainda tem mensagens pendentes
- Mesma abordagem ja validada no automation_control

