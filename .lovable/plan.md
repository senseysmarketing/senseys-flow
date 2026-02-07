
## Plano: Corrigir Disparo Automático de Mensagens WhatsApp

### Problemas Identificados

1. **Fila está pendente mas não processada**: A mensagem foi corretamente enfileirada na `whatsapp_message_queue` com status `pending`, mas a função `process-whatsapp-queue` nunca foi chamada para processá-la.

2. **Conflito de autenticação**: A função `whatsapp-send` exige token de autenticação do usuário, mas quando chamada internamente pela `process-whatsapp-queue` (via `supabase.functions.invoke`), não há token de usuário disponível.

3. **Formatação de número inconsistente**: Números podem vir em diferentes formatos:
   - Meta Ads: `+5516981057418` (com + e país)
   - Manual: `16981057418` (sem país)
   - Outros: `(16) 98105-7418` (formatado)

### Solução Proposta

#### 1. Modificar `whatsapp-send` para Aceitar Chamadas Internas

Permitir que a função seja chamada sem autenticação quando vinda de outra edge function (usando service role key):

```typescript
// Verificar se é chamada interna (service role) ou externa (user token)
const authHeader = req.headers.get('Authorization')
const isInternalCall = req.headers.get('x-internal-call') === 'true'

if (!authHeader && !isInternalCall) {
  return unauthorized response
}

// Para chamadas internas, obter account_id do body
if (isInternalCall) {
  accountId = body.account_id
} else {
  // Fluxo atual de autenticação de usuário
}
```

#### 2. Melhorar Formatação de Número

Criar função robusta que lida com todos os formatos:

```typescript
function formatPhoneForEvolution(phone: string): string {
  // Remove tudo que não é dígito
  let cleaned = phone.replace(/\D/g, '')
  
  // Remove o "+" que pode ter ficado (se houver)
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1)
  }
  
  // Se já começa com 55, está ok
  if (cleaned.startsWith('55')) {
    return cleaned
  }
  
  // Se tem 10-11 dígitos (DDD + número), adiciona 55
  if (cleaned.length >= 10 && cleaned.length <= 11) {
    return '55' + cleaned
  }
  
  // Retorna como está (pode ser número internacional)
  return cleaned
}
```

#### 3. Adicionar Trigger para Processar Fila Automaticamente

Opção A - Chamar `process-whatsapp-queue` imediatamente após inserir na fila (no frontend)
Opção B - Usar pg_cron para executar a cada minuto (requer configuração adicional)

Vamos usar **Opção A** por ser mais simples e imediata.

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/whatsapp-send/index.ts` | Aceitar chamadas internas sem auth de usuário |
| `supabase/functions/process-whatsapp-queue/index.ts` | Adicionar header de chamada interna + melhorar formatação |
| `src/components/whatsapp/WhatsAppIntegrationSettings.tsx` | Chamar processamento da fila após inserir mensagem |

### Detalhes Técnicos

#### Arquivo: `supabase/functions/whatsapp-send/index.ts`

```typescript
// Adicionar suporte para chamadas internas
const authHeader = req.headers.get('Authorization')
const isInternalCall = req.headers.get('x-internal-call') === 'true'

let accountId: string

if (isInternalCall) {
  // Chamada interna - account_id vem no body
  const body = await req.json()
  accountId = body.account_id
  
  if (!accountId) {
    return Response 400 - account_id required for internal calls
  }
} else {
  // Chamada externa - validar token de usuário
  if (!authHeader) {
    return Response 401 - Unauthorized
  }
  // ... validação de usuário existente ...
}
```

#### Arquivo: `supabase/functions/process-whatsapp-queue/index.ts`

```typescript
// Função melhorada de formatação
function formatPhoneForEvolution(phone: string): string {
  let cleaned = phone.replace(/\D/g, '')
  
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    return cleaned
  }
  
  if (cleaned.length >= 10 && cleaned.length <= 11) {
    return '55' + cleaned
  }
  
  return cleaned
}

// Na chamada da função whatsapp-send
const sendResponse = await fetch(
  `${supabaseUrl}/functions/v1/whatsapp-send`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'x-internal-call': 'true'
    },
    body: JSON.stringify({
      account_id: msg.account_id,
      phone: formatPhoneForEvolution(phone),
      message: message,
      lead_id: msg.lead_id,
      template_id: msg.template_id
    })
  }
)
```

#### Arquivo: `src/components/whatsapp/WhatsAppIntegrationSettings.tsx`

Adicionar chamada para processar fila após inserir mensagem (já existe trigger automático via regras de automação, mas precisamos garantir que a função de processamento seja chamada):

```typescript
// Após inserir mensagem na fila, chamar processamento
const processQueue = async () => {
  await supabase.functions.invoke('process-whatsapp-queue')
}

// Chamar após salvar regra de automação ou quando lead é criado
```

### Fluxo Corrigido

```text
Lead criado (manual/meta/webhook)
        ↓
Frontend verifica regras de automação
        ↓
Mensagem inserida na whatsapp_message_queue
        ↓
Frontend chama process-whatsapp-queue  ← NOVO
        ↓
process-whatsapp-queue busca mensagens pending
        ↓
Formata número corretamente
        ↓
Chama whatsapp-send com x-internal-call: true
        ↓
whatsapp-send envia para Evolution API
        ↓
Mensagem entregue!
```

### Formato de Número - Regras

| Entrada | Saída (para Evolution) |
|---------|----------------------|
| `+5516981057418` | `5516981057418` |
| `5516981057418` | `5516981057418` |
| `16981057418` | `5516981057418` |
| `(16) 98105-7418` | `5516981057418` |
| `981057418` | `55981057418` (assume sem DDD) |

### Resultado Esperado

- Mensagens serão processadas imediatamente após inserção na fila
- Números serão formatados corretamente independente da origem
- Logs detalhados para debugging
- Compatibilidade com Meta, webhooks e leads manuais
