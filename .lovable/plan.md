

## Plano: Detectar Desconexão do WhatsApp em Tempo Real

### Problema Identificado

O código atual na action `status` da edge function `whatsapp-connect` tem um bug na linha 353:

```typescript
const isConnected = statusData.instance?.state === 'open'
const newStatus = isConnected ? 'connected' : session.status  // ← Bug aqui!
```

Quando o WhatsApp é desconectado pelo celular:
- A Evolution API retorna `state: 'close'`
- O código mantém `session.status` (que é `'connected'`)
- O banco nunca é atualizado para `'disconnected'`

### Solução

1. **Corrigir a lógica de status**: Atualizar para `'disconnected'` quando não conectado
2. **Adicionar verificação periódica**: Verificar status ao carregar a página de configurações
3. **Melhorar feedback**: Mostrar quando a última verificação foi feita

### Mudanças Necessárias

#### 1. Edge Function: `supabase/functions/whatsapp-connect/index.ts`

Na action `status` (linha 352-354), corrigir a lógica:

```typescript
// Antes (bug)
const isConnected = statusData.instance?.state === 'open'
const newStatus = isConnected ? 'connected' : session.status

// Depois (corrigido)
const isConnected = statusData.instance?.state === 'open'
const newStatus = isConnected ? 'connected' : 'disconnected'
```

Também atualizar a condição de update (linha 362) para sempre atualizar quando o status mudar.

#### 2. Frontend: `src/components/whatsapp/WhatsAppIntegrationSettings.tsx`

Adicionar verificação automática de status quando a página é carregada:

```typescript
// Na função fetchSession, sempre verificar status na API quando mostra como conectado
const checkRealStatus = async () => {
  if (!user) return;
  
  const response = await supabase.functions.invoke('whatsapp-connect?action=status');
  
  // Se API diz desconectado mas banco diz conectado, atualizar UI
  if (response.data && !response.data.connected) {
    setSession(prev => prev ? { ...prev, status: 'disconnected' } : null);
    
    if (session?.status === 'connected') {
      toast({
        variant: 'destructive',
        title: 'WhatsApp Desconectado',
        description: 'A conexão com o WhatsApp foi perdida. Reconecte para continuar.',
      });
    }
  }
};
```

### Fluxo Após Correção

```text
Usuário desconecta WhatsApp no celular
        ↓
Evolution API: state = 'close'
        ↓
Usuário abre página de configurações
        ↓
Frontend chama action=status
        ↓
Edge function verifica Evolution API
        ↓
state !== 'open' → newStatus = 'disconnected'
        ↓
Atualiza banco de dados
        ↓
Retorna { connected: false }
        ↓
Frontend atualiza UI + mostra alerta
```

### Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/whatsapp-connect/index.ts` | Corrigir lógica de status (linha 353) |
| `src/components/whatsapp/WhatsAppIntegrationSettings.tsx` | Adicionar verificação proativa |

### Detalhes Técnicos

A correção principal está na edge function:

```typescript
case 'status': {
  // ...existing code...
  
  if (statusResponse.ok) {
    const statusData = await statusResponse.json()
    const isConnected = statusData.instance?.state === 'open'
    
    // CORREÇÃO: Atualizar para 'disconnected' quando não conectado
    const newStatus = isConnected ? 'connected' : 'disconnected'
    
    // Se desconectado, limpar dados de conexão
    if (!isConnected && session.status === 'connected') {
      await supabase
        .from('whatsapp_sessions')
        .update({ 
          status: 'disconnected',
          connected_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('account_id', accountId)
    }
    // ...rest of code...
  }
}
```

### Resultado Esperado

- Quando WhatsApp desconectado pelo celular, status será atualizado para "Desconectado"
- Usuário verá alerta informando que precisa reconectar
- Botão "Conectar WhatsApp" aparecerá novamente
- Automações serão automaticamente desabilitadas

