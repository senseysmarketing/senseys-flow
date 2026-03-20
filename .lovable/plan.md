

## Correção: Conversas do WhatsApp não aparecendo em tempo real

### Diagnóstico

Ao analisar o hook `use-conversations.tsx`, identifiquei dois problemas:

1. **Realtime UPDATE ignora conversas fora da lista**: Quando uma conversa recebe um UPDATE (nova mensagem), o handler apenas atualiza conversas já presentes no state local (`prev.map(...)`). Se a conversa não estava na lista inicial (por exemplo, `session_phone` foi corrigido ou era `null` e agora tem valor), ela nunca aparece sem refresh manual.

2. **Realtime INSERT faz refetch completo** mas o **UPDATE não** — quando chega uma mensagem nova em conversa existente, apenas os campos são atualizados in-place. Se a conversa foi filtrada na query inicial (por `session_phone` ou `@lid`), ela fica invisível permanentemente até refresh.

### Solução no `src/hooks/use-conversations.tsx`

#### Correção 1: UPDATE handler com fallback para refetch

No handler de UPDATE (linhas 190-199), se a conversa atualizada não existir no state local, fazer um refetch para incluí-la:

```typescript
(payload) => {
  const updated = payload.new as any;
  setConversations(prev => {
    const exists = prev.some(c => c.id === updated.id);
    if (!exists) {
      // Conversation not in local list — trigger full refetch to enrich with lead data
      fetchConversations();
      return prev;
    }
    return prev
      .map(c => c.id === updated.id ? { ...c, ...updated } : c)
      .sort((a, b) =>
        new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
      );
  });
}
```

#### Correção 2: Debounce para evitar refetches duplicados

Como INSERT já faz refetch e UPDATE agora também pode fazer, adicionar um debounce simples com `useRef` para evitar múltiplos refetches simultâneos:

```typescript
const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const debouncedRefetch = useCallback(() => {
  if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
  refetchTimerRef.current = setTimeout(() => fetchConversations(), 300);
}, [fetchConversations]);
```

Usar `debouncedRefetch` tanto no INSERT handler quanto no fallback do UPDATE handler.

#### Correção 3: Filtro de session_phone mais resiliente

No fetch inicial (linha 95), expandir o filtro `or` para incluir também conversas cujo `session_phone` contenha os últimos 8 dígitos do phone atual (para lidar com variações de formato):

```typescript
const phoneSuffix = currentPhone.slice(-8);
// Keep exact match + null + suffix match for format variations
.or(`session_phone.eq.${currentPhone},session_phone.is.null,session_phone.like.%${phoneSuffix}`)
```

### O que NÃO muda
- Lógica de envio de mensagens
- Enriquecimento com dados do lead
- Realtime de mensagens individuais (já funciona)
- RLS policies no banco

