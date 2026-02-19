
## Correção: Verificação de Origem OLX na Saudação Automática

### Causa Raiz do Bug

O `olx-webhook` normaliza o payload e encaminha para `webhook-leads` via HTTP interno. Dentro do `webhook-leads`, na hora de verificar se deve ou não disparar a saudação do WhatsApp (linhas 641-663), o código verifica apenas a chave `webhook` do `trigger_sources`:

```typescript
const webhookEnabled = sources.webhook !== false
if (automationRule.template_id && webhookEnabled) { ... }
```

O problema: o lead vindo do OLX tem `origem: 'Grupo OLX'` no banco, mas o `webhook-leads` não sabe que foi o OLX quem originou a chamada — ele só vê que veio por uma chamada HTTP e verifica a chave `webhook`. A chave `olx` nunca é verificada.

### Solução

Duas mudanças coordenadas:

**1. `supabase/functions/olx-webhook/index.ts`**

Adicionar um campo `_source: 'olx'` ao payload que é encaminhado para `webhook-leads`, sinalizando a origem real:

```typescript
body: JSON.stringify({
  ...normalizedPayload,
  _source: 'olx',   // ← novo campo sinalizador
}),
```

**2. `supabase/functions/webhook-leads/index.ts`**

Na seção de verificação de `trigger_sources` (linhas 640-663), detectar se a chamada veio do OLX via `body._source === 'olx'` e verificar a chave `olx` em vez de `webhook`:

```typescript
// Determinar a origem real da chamada
const callSource = body._source === 'olx' ? 'olx' : 'webhook'

const sources = automationRule.trigger_sources || { webhook: true }
const sourceEnabled = typeof sources === 'object' && sources !== null
  ? (sources as Record<string, boolean>)[callSource] !== false
  : true

if (automationRule.template_id && sourceEnabled) { ... }
```

### O Mesmo Bug Existe nas Regras Condicionais?

Sim, parcialmente. Nas regras condicionais com `condition_type: 'origin'`, a comparação já usa `leadData.origem` que para o OLX é `'Grupo OLX'` — isso funciona corretamente. O bug existe apenas no fallback para a regra padrão de automação.

### Arquivos a Modificar

1. **`supabase/functions/olx-webhook/index.ts`** — linha 181: adicionar `_source: 'olx'` ao payload encaminhado.

2. **`supabase/functions/webhook-leads/index.ts`** — linhas 650-663: trocar verificação de `webhookEnabled` para verificar a chave correta com base em `body._source`.

### Impacto

- Se OLX desmarcado → saudação não é enviada para leads do OLX ✓
- Se OLX marcado → saudação é enviada normalmente ✓
- Leads de webhook padrão → comportamento inalterado ✓
- Regras condicionais → inalteradas ✓
