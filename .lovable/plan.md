

## Plano: Corrigir Busca do Número de Telefone do WhatsApp

### Problema Identificado

Analisando os logs da edge function:

```
[whatsapp-connect] Fetched phone number: null
[whatsapp-connect] Status data: { instance: { instanceName: "...", state: "open" } }
```

A função `fetchPhoneNumber` está retornando `null` porque:
1. O endpoint `/instance/fetchInstances` não está retornando o campo `owner` 
2. Ou a estrutura da resposta é diferente do esperado

Segundo a documentação da Evolution API, a resposta deveria ser:
```json
[{"instance": {"owner": "5516981057418@s.whatsapp.net", ...}}]
```

### Solução

Modificar a função `fetchPhoneNumber` para:
1. **Adicionar logging detalhado** da resposta da API
2. **Verificar estruturas alternativas** de resposta
3. **Incluir fallback** usando o endpoint `/instance/connectionState` que pode retornar informações adicionais

### Mudanças Necessárias

#### Arquivo: `supabase/functions/whatsapp-connect/index.ts`

##### Atualizar função `fetchPhoneNumber` com logging e fallbacks

```typescript
async function fetchPhoneNumber(instanceName: string): Promise<string | null> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) return null
  
  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${instanceName}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    )
    const data = await response.json()
    
    // Log para debug da estrutura de resposta
    console.log('[whatsapp-connect] fetchInstances response:', JSON.stringify(data).substring(0, 500))
    
    // Tentar diferentes estruturas de resposta
    let owner = data[0]?.instance?.owner
    
    // Fallback: algumas versões podem ter estrutura diferente
    if (!owner && data?.instance?.owner) {
      owner = data.instance.owner
    }
    
    // Fallback: objeto direto sem array
    if (!owner && data?.owner) {
      owner = data.owner
    }
    
    // Fallback: buscar de profileName ou outros campos
    if (!owner) {
      // Tentar buscar número do campo 'number' ou 'phone'
      const number = data[0]?.instance?.number || 
                     data[0]?.number || 
                     data?.instance?.number ||
                     data?.number
      if (number) {
        owner = `${number}@s.whatsapp.net`
      }
    }
    
    console.log('[whatsapp-connect] Extracted owner:', owner)
    
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

### Fluxo de Debug

1. Deploy da nova versão com logging detalhado
2. Acessar a página de configurações do WhatsApp
3. Verificar os logs para ver a estrutura real da resposta
4. Ajustar o código conforme necessário

### Resultado Esperado

Após a correção:
- Logs mostrarão exatamente o que a Evolution API está retornando
- O código tentará múltiplas estruturas de resposta
- O número será capturado e exibido na interface

### Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/whatsapp-connect/index.ts` | Atualizar `fetchPhoneNumber` com logging e fallbacks |

