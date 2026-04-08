

## Recuperar Instância WhatsApp "Marinho" Travada em "Connecting"

### Diagnóstico

A instância `senseys_98bbd535_b8a4_4a5f_80da_e1e0e35f6809` está presa no estado `connecting` na Evolution API. Os logs mostram dezenas de chamadas de status consecutivas, todas retornando `state: "connecting"`. O usuário desconectou e reconectou, mas a instância não conseguiu completar a reconexão.

O DB mostra `status: qr_ready` mas a Evolution API retorna `connecting` — a instância está corrompida/travada.

### Plano de Correção

#### 1. Intervenção imediata: Deletar e recriar a instância
Executar um script administrativo temporário que:
1. **Deleta** a instância na Evolution API (`DELETE /instance/delete/{instanceName}`)
2. **Limpa** o registro na tabela `whatsapp_sessions` (status → `disconnected`, qr_code → null)
3. O usuário poderá então reconectar normalmente pelo CRM

Isso é necessário porque `restart` e `logout` não resolvem instâncias presas em `connecting`.

#### 2. Resetar automações falhadas
Atualizar os 3 registros recentes de `whatsapp_automation_control` com `status = 'failed'` e `retry_count = 5` (de 6, 7 e 8 de abril) para `status = 'active'`, `retry_count = 0`, para que sejam reprocessados quando a instância voltar.

#### 3. Melhoria no código: Tratar estado "connecting" travado
**Arquivo**: `supabase/functions/whatsapp-connect/index.ts`

No action `status`, quando a Evolution API retorna `state: "connecting"`:
- Atualmente o código trata como `disconnected` (correto)
- Adicionar: se o DB mostra que a sessão está em `connecting`/`qr_ready` há mais de 5 minutos, executar automaticamente um `DELETE /instance/delete` + recriação, em vez de apenas reportar como desconectado

Isso evita que instâncias fiquem presas indefinidamente.

### Arquivos a modificar

| Arquivo | Ação |
|---|---|
| Script temporário (edge function) | Deletar instância + limpar DB + resetar automações |
| `supabase/functions/whatsapp-connect/index.ts` | Auto-recuperação para instâncias travadas em "connecting" por mais de 5 min |

### Resultado Esperado
1. Instância deletada e limpa imediatamente
2. Caique poderá reconectar o WhatsApp pelo CRM
3. Leads com automações falhadas serão reprocessados
4. No futuro, instâncias travadas em "connecting" serão auto-recuperadas

