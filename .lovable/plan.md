

## Diagnóstico: Falhas de Envio WhatsApp — Conta Marinho

### Causa Raiz

A instância Evolution API da conta "Caique Marinho" (`senseys_98bbd535_...`) está em **estado degradado**. Ela reporta como "connected" (state: open), mas retorna erro `400 Bad Request` com `"Error: not-acceptable"` em todas as tentativas de envio. A instância precisa ser reiniciada.

**Teste realizado**: chamei `whatsapp-send` diretamente e recebi:
```json
{
  "status": 400,
  "error": "Bad Request",
  "response": {"message": ["Error: not-acceptable"]}
}
```

### Impacto

Desde ~6 de abril às 15h, **todas** as mensagens automáticas falharam para estes leads:
- Juliana Nascimento (+5511971426334)
- Cynthia Steinmeyer Mussolin (+5511992448992)
- Ramona Sousa (+5511984203840)
- Larissa Hon (+5511991981419)
- Ronaldo Dias (+5511971583435)
- Andrea Ambros (+5551996638771)
- Lucia Maria Occhialini (+5511987773047)

Todas as automações atingiram o limite de 5 retries e foram marcadas como `failed`.

### Plano de Correção

#### 1. Reiniciar a instância Evolution API
Criar um script temporário que chama diretamente a Evolution API para reiniciar a instância `senseys_98bbd535_b8a4_4a5f_80da_e1e0e35f6809` e reconfigurar o webhook.

#### 2. Resetar automações falhadas
Atualizar os registros `whatsapp_automation_control` que falharam por este problema (retry_count = 5, status = failed) para:
- `status = 'active'`
- `retry_count = 0`
- `next_execution_at = now()`

Isso fará o cron job reprocessá-los na próxima execução.

#### 3. Melhoria no código: Auto-restart em erro "not-acceptable"
**Arquivo**: `supabase/functions/process-whatsapp-queue/index.ts`

Adicionar detecção do erro `not-acceptable` na lógica de retry. Quando esse erro específico for detectado:
- Tentar reiniciar a instância automaticamente via Evolution API (`PUT /instance/restart/{instanceName}`)
- Aguardar 5s e reconfigurar o webhook
- Só depois incrementar retry_count

Isso evita que o sistema queime 5 tentativas seguidas sem resolver o problema real.

#### 4. Melhoria no código: Detecção no whatsapp-send
**Arquivo**: `supabase/functions/whatsapp-send/index.ts`

Na função `normalizeEvolutionError`, tratar `not-acceptable` como erro de instância degradada com mensagem específica em português: "Instância do WhatsApp em estado degradado. Reiniciando automaticamente..."

### Arquivos a Modificar

| Arquivo | Ação |
|---|---|
| Script temporário | Reiniciar instância + resetar automações |
| `supabase/functions/process-whatsapp-queue/index.ts` | Adicionar auto-restart em erro "not-acceptable" |
| `supabase/functions/whatsapp-send/index.ts` | Melhorar detecção de erro "not-acceptable" |

### Resultado Esperado

1. Instância reiniciada e funcional imediatamente
2. Leads afetados receberão suas mensagens na próxima execução do cron
3. No futuro, erros "not-acceptable" dispararão auto-restart preventivo

