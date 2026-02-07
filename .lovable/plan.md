

## Plano: Corrigir Exibição do Número de Telefone Conectado

### Problema Identificado

O número de telefone está `null` no banco de dados (`whatsapp_sessions.phone_number`). Isso aconteceu porque:

1. O código para capturar o número foi adicionado no `whatsapp-webhook`, que recebe eventos de `connection.update`
2. Porém, a conexão já estava estabelecida **antes** desse código ser implementado
3. Como o evento de conexão já passou, o webhook nunca recebeu o `connection.update` com o novo código

### Solução

Atualizar a edge function `whatsapp-connect` para buscar e salvar o número de telefone nas ações `status` e `qr-code` (quando já conectado), garantindo que o número seja capturado mesmo para sessões existentes.

### Mudanças Necessárias

#### Arquivo: `supabase/functions/whatsapp-connect/index.ts`

##### 1. Criar função auxiliar para buscar número de telefone

```typescript
async function fetchPhoneNumber(instanceName: string): Promise<string | null> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) return null
  
  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${instanceName}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    )
    const data = await response.json()
    const owner = data[0]?.instance?.owner
    
    if (owner) {
      const phoneRaw = owner.split('@')[0]
      if (phoneRaw.length >= 12) {
        const countryCode = phoneRaw.slice(0, 2)
        const areaCode = phoneRaw.slice(2, 4)
        const firstPart = phoneRaw.slice(4, 9)
        const secondPart = phoneRaw.slice(9)
        return `+${countryCode} (${areaCode}) ${firstPart}-${secondPart}`
      }
      return `+${phoneRaw}`
    }
  } catch (e) {
    console.log('[whatsapp-connect] Error fetching phone:', e)
  }
  return null
}
```

##### 2. Atualizar ação `status` para buscar número quando conectado

Na ação `status`, quando `isConnected === true`, buscar o número se ainda não existir:

```typescript
if (isConnected && !session.phone_number) {
  const phoneNumber = await fetchPhoneNumber(instanceName)
  if (phoneNumber) {
    await supabase
      .from('whatsapp_sessions')
      .update({ phone_number: phoneNumber })
      .eq('account_id', accountId)
  }
}
```

##### 3. Atualizar ação `qr-code` para buscar número quando já conectado

Na parte que detecta que já está conectado (`connectData.instance?.state === 'open'`):

```typescript
// Buscar número de telefone
const phoneNumber = await fetchPhoneNumber(instanceName)

await supabase
  .from('whatsapp_sessions')
  .update({ 
    status: 'connected',
    phone_number: phoneNumber,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  .eq('account_id', accountId)
```

### Fluxo Após Correção

```text
Usuário abre página de configurações
         ↓
Frontend chama whatsapp-connect?action=status
         ↓
Detecta que está conectado mas phone_number é null
         ↓
Busca número via Evolution API (/instance/fetchInstances)
         ↓
Atualiza banco com phone_number formatado
         ↓
Frontend exibe "Número: +55 (16) 98105-7418"
```

### Resultado Esperado

Após a correção, quando o usuário acessar a página de configurações do WhatsApp:

- O sistema automaticamente buscará o número do telefone conectado
- O número será exibido no formato: `+55 (16) 98105-7418`
- A informação aparecerá ao lado de "Conectado desde:"

### Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/whatsapp-connect/index.ts` | Adicionar função auxiliar e lógica para buscar número nas ações `status` e `qr-code` |

