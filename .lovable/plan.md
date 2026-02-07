

## Plano: Corrigir Exibição do Número de Telefone na Inicialização

### Problema Identificado

Quando a página de configurações é carregada:
1. O componente chama apenas `fetchSession()` que lê diretamente do banco de dados
2. O banco tem `phone_number = null` porque foi conectado antes do código de captura
3. A edge function `whatsapp-connect?action=status` (que busca o número) só é chamada durante o polling do QR modal

### Solução

Modificar o componente `WhatsAppIntegrationSettings.tsx` para chamar a edge function de status quando a sessão estiver conectada mas sem número de telefone.

### Mudanças Necessárias

#### Arquivo: `src/components/whatsapp/WhatsAppIntegrationSettings.tsx`

##### Atualizar a função `fetchSession` para chamar a edge function quando necessário

```typescript
const fetchSession = useCallback(async () => {
  if (!user) return;

  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .select('*')
    .maybeSingle();

  if (!error && data) {
    setSession(data);
    
    // Se conectado mas sem número, buscar da API
    if (data.status === 'connected' && !data.phone_number) {
      try {
        const response = await supabase.functions.invoke('whatsapp-connect?action=status');
        if (response.data?.phoneNumber) {
          // Atualizar estado local com o número
          setSession(prev => prev ? { ...prev, phone_number: response.data.phoneNumber } : null);
        }
      } catch (e) {
        console.log('Error fetching phone number:', e);
      }
    }
  } else {
    setSession(null);
  }
}, [user]);
```

### Fluxo Após Correção

```text
Página carrega
     ↓
fetchSession() busca do banco
     ↓
status === 'connected' && phone_number === null?
     ↓
Sim → Chama edge function status
     ↓
Edge function busca número da Evolution API
     ↓
Atualiza banco E retorna número
     ↓
Frontend atualiza estado local
     ↓
Número exibido na UI
```

### Resultado Esperado

Ao abrir a página de configurações do WhatsApp:
- O número do telefone conectado será exibido automaticamente
- Formato: `+55 (16) 98105-7418`
- Aparecerá na linha "Número: +55 (16) 98105-7418  Conectado desde: 06/02/2026"

