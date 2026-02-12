

## Correcao: Formatacao de telefone e vinculacao com numeros @lid

### Problema

A Evolution API envia mensagens com dois tipos de JID:
- `@s.whatsapp.net` - numeros reais de telefone (ex: `5541995953025@s.whatsapp.net`)
- `@lid` - IDs internos do WhatsApp (ex: `275419089621128@lid`) que NAO sao numeros de telefone

O sistema trata ambos como telefones reais, causando:
1. **Formatacao quebrada**: numeros LID como `275419089621128` sao formatados como `+27 (54) 19089-621128` (parece um numero invalido)
2. **Vinculacao impossivel**: leads nunca sao encontrados por sufixo de telefone quando o JID e do tipo LID
3. **Exibicao confusa**: usuarios veem numeros sem sentido na lista de conversas

### Solucao

**1. Criar funcao centralizada de formatacao de telefone**

Uma unica funcao `formatPhoneForDisplay` em `src/lib/utils.ts` que:
- Detecta se e um numero brasileiro valido (13 digitos, comeca com 55) e formata como `+55 (XX) XXXXX-XXXX`
- Detecta se e um numero brasileiro sem 9o digito (12 digitos) e formata adequadamente
- Para numeros LID ou desconhecidos, exibe apenas "WhatsApp" ou o nome de contato, sem tentar formatar

**2. Filtrar/marcar conversas @lid no webhook**

No `whatsapp-webhook/index.ts`, ao processar mensagens de JIDs `@lid`:
- Tentar resolver o numero real via `pushName` e busca no banco
- Marcar a conversa com um campo indicando que o phone nao e confiavel
- Priorizar o lead vinculado (se houver) para exibir o telefone correto

**3. Atualizar todos os pontos de exibicao de telefone**

Substituir as formatacoes inline em:
- `ConversationList.tsx` (linha 34-35)
- `ChatView.tsx` (linha 104-106)

### Secao tecnica

**Arquivo: `src/lib/utils.ts`**

Adicionar funcao centralizada:

```typescript
export function formatPhoneForDisplay(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  
  // Brazilian number with 9th digit: 55 + DD + 9XXXXXXXX = 13 digits
  if (cleaned.length === 13 && cleaned.startsWith('55')) {
    return `+55 (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  }
  
  // Brazilian number without 9th digit: 55 + DD + XXXXXXXX = 12 digits
  if (cleaned.length === 12 && cleaned.startsWith('55')) {
    return `+55 (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
  }
  
  // Brazilian number without country code: DD + 9XXXXXXXX = 11 digits
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  
  // Brazilian number without country code, without 9th digit: DD + XXXXXXXX = 10 digits
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  
  // LID or unknown format (15+ digits, doesn't start with valid country code)
  // Don't try to format - return as-is or empty
  if (cleaned.length > 13) {
    return ''; // Will be hidden in favor of contact name
  }
  
  return phone;
}

export function isLidJid(remoteJid: string): boolean {
  return remoteJid.endsWith('@lid');
}
```

**Arquivo: `src/components/conversations/ConversationList.tsx`**

Alterar `getDisplayName` para usar a funcao centralizada e mostrar o telefone formatado como subtexto (ou ocultar para LIDs):

```typescript
import { formatPhoneForDisplay, isLidJid } from "@/lib/utils";

const getDisplayName = (conv: Conversation) => {
  if (conv.lead?.name) return conv.lead.name;
  if (conv.contact_name) return conv.contact_name;
  const formatted = formatPhoneForDisplay(conv.phone);
  return formatted || conv.phone;
};

const getDisplayPhone = (conv: Conversation) => {
  // If lead has a real phone, show that
  if (conv.lead?.phone) return formatPhoneForDisplay(conv.lead.phone);
  // If conversation phone is valid (not LID), format it
  if (!isLidJid(conv.remote_jid)) return formatPhoneForDisplay(conv.phone);
  return ''; // Hide phone for LID contacts
};
```

Adicionar a exibicao do telefone formatado abaixo do nome na lista.

**Arquivo: `src/components/conversations/ChatView.tsx`**

Substituir a formatacao inline pelo uso da funcao centralizada:

```typescript
import { formatPhoneForDisplay } from "@/lib/utils";

// Substituir linhas 103-107:
<p className="text-[11px] text-muted-foreground truncate">
  {conversation.lead?.phone 
    ? formatPhoneForDisplay(conversation.lead.phone) 
    : formatPhoneForDisplay(conversation.phone) || conversation.contact_name || ''
  }
</p>
```

**Arquivo: `supabase/functions/whatsapp-webhook/index.ts`**

Melhorar o tratamento de JIDs @lid - ao salvar conversa/mensagem, tentar vincular ao lead usando `pushName` se o JID for @lid:

```typescript
// Ao processar mensagem com @lid, tentar encontrar lead pelo pushName
if (remoteJid.endsWith('@lid') && contactName) {
  const { data: leadByName } = await supabase
    .from('leads')
    .select('id, phone')
    .eq('account_id', session.account_id)
    .ilike('name', `%${contactName}%`)
    .limit(1);
  
  if (leadByName?.[0]) {
    leadId = leadByName[0].id;
    // Use the lead's real phone for the conversation
  }
}
```

### Resultado esperado

1. Numeros brasileiros aparecem corretamente formatados como `+55 (XX) XXXXX-XXXX`
2. Contatos com JID @lid mostram o nome de contato ao inves de numeros sem sentido
3. O telefone do lead (quando vinculado) tem prioridade sobre o phone da conversa
4. A funcao centralizada evita duplicacao e garante consistencia em toda a interface
