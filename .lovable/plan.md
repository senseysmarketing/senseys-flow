

## Bug: Follow-ups não cancelados quando lead responde — Problema de normalização de telefone BR

### Causa Raiz

O número da Lúcia está armazenado no lead como `+554188791919` (sem o nono dígito móvel), mas o WhatsApp envia respostas com o JID `5541988791919@s.whatsapp.net` (com o 9). Isso causa **3 falhas em cascata**:

1. **Webhook não encontra o lead**: `findLeadByPhone` usa `slice(-9)` do telefone da resposta = `988791919`. Busca `%988791919%` no campo phone do lead `+554188791919` → **não encontra** (o lead tem `188791919` nos últimos 9 dígitos)

2. **Automação não é cancelada**: Como o lead não foi encontrado, o bloco que faz `update automation_control set status = 'responded'` nunca executa

3. **Fallback do cron falha também**: O `process-whatsapp-queue` tenta buscar por `record.phone.slice(-9)` = `188791919`, mas a conversa com a resposta tem phone `5541988791919` que não contém `188791919`

**Resultado**: Duas conversas separadas no banco — uma com o lead (sem resposta), outra com as respostas (sem lead). O sistema nunca cruza as duas.

**Escopo**: Afeta qualquer lead cujo telefone está salvo com 8 dígitos na parte local (formato antigo BR), pois o WhatsApp normaliza para 9 dígitos. Vi vários na lista de automações ativas: `+554187097574`, `+554199523885`, `+554195860515`, etc.

### Plano de Correção

#### 1. Criar função utilitária `normalizeBRPhone` (ambos os arquivos)
Função que, dado um telefone brasileiro (DDD 2 dígitos + número), gera variantes com e sem o nono dígito para busca:
- Se o número local tem 8 dígitos → adiciona o 9
- Se tem 9 dígitos → remove o 9
- Retorna array de sufixos para busca

#### 2. Corrigir `findLeadByPhone` no webhook
**Arquivo**: `supabase/functions/whatsapp-webhook/index.ts`

Ao buscar lead por telefone, gerar os dois sufixos possíveis (com e sem o 9) e fazer a busca com `or`:
```
ilike phone %988791919% OR ilike phone %88791919%
```

#### 3. Corrigir busca de leads no bloco de resposta do webhook (linha ~532)
Mesma lógica: usar ambos os sufixos para garantir que o lead `+554188791919` seja encontrado quando a resposta vem de `5541988791919`

#### 4. Corrigir fallback phone-based no `process-whatsapp-queue`
**Arquivo**: `supabase/functions/process-whatsapp-queue/index.ts`

Na busca de conversas por phone suffix (linhas ~433 e ~537), gerar ambos os sufixos e usar `or` para cobrir os dois formatos.

#### 5. Unificar conversas duplicadas (script pontual)
Executar um script que:
- Encontra pares de conversas para o mesmo número real (com/sem 9) na mesma conta
- Transfere o `lead_id` e `last_customer_message_at` para a conversa principal
- Marca a automação da Lúcia e similares como `responded`

### Arquivos a Modificar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/whatsapp-webhook/index.ts` | `findLeadByPhone` e bloco de resposta: busca com dois sufixos BR |
| `supabase/functions/process-whatsapp-queue/index.ts` | Fallback phone-based: busca com dois sufixos BR |
| Script temporário | Corrigir automações ativas que já receberam resposta |

### Resultado Esperado
1. Respostas de leads são detectadas corretamente mesmo com variação do nono dígito
2. Automações são canceladas imediatamente ao receber resposta
3. Lúcia e leads similares terão follow-ups cancelados retroativamente
