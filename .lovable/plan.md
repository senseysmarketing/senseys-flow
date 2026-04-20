

## Recuperar Instância WhatsApp "Braz Imóveis" (sem reprocessar automações)

### Diagnóstico

- Conta: **Oswaldo Braz / Braz Imóveis** (`7629c620-65a5-4e89-afbf-599cd221db5d`)
- Instância: `senseys_7629c620_65a5_4e89_afbf_599cd221db5d`
- Estado: travada em `connecting` na Evolution API, não responde a restart/logout
- Auto-recovery existente (no `whatsapp-connect`) só dispara quando o frontend chama `?action=status`, mas a UI não consegue completar a chamada porque a instância está totalmente travada

### Plano de Correção

#### 1. Hard reset da instância (intervenção pontual)
Executar uma edge function administrativa temporária que:
1. `DELETE /instance/delete/senseys_7629c620_65a5_4e89_afbf_599cd221db5d` na Evolution API
2. Atualiza `whatsapp_sessions` da conta para `status = 'disconnected'`, `qr_code = null`, `phone_number = null`
3. Deleta a própria edge function após execução

**Não** será feito reset de automações — o usuário já enviou as mensagens manualmente.

#### 2. Auto-recovery proativa via cron
**Arquivo**: `supabase/functions/process-whatsapp-queue/index.ts`

Adicionar verificação no início de cada execução do cron: para cada conta com sessão em `connecting` ou `qr_ready` há mais de **10 minutos**, consultar `GET /instance/connectionState/{instanceName}`. Se confirmado `connecting`, executar `DELETE /instance/delete` + reset do `whatsapp_sessions` (status `disconnected`, qr_code null, phone_number null).

Isso garante que instâncias travadas se auto-corrijam **sem depender do usuário abrir a tela de status**, evitando que clientes fiquem horas/dias sem WhatsApp funcionando.

### Arquivos a modificar

| Arquivo | Ação |
|---|---|
| Edge function temporária | Hard reset da instância Braz + limpar DB (sem mexer em automações) |
| `supabase/functions/process-whatsapp-queue/index.ts` | Auto-recovery proativa de instâncias travadas em `connecting`/`qr_ready` há +10min |

### Resultado Esperado

1. Instância da Braz Imóveis deletada e limpa imediatamente — Caique poderá reconectar pelo CRM
2. Automações permanecem como estão (não serão reprocessadas)
3. No futuro, qualquer conta travada será auto-recuperada pelo cron sem depender de interação do usuário

