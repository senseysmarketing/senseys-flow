

## Plano: Corrigir Extração do Número de Telefone

### Problema Identificado

O código atual está buscando em caminhos errados:
- ❌ `data[0]?.instance?.owner`
- ❌ `data?.instance?.owner`
- ❌ `data?.owner`

**Caminho correto encontrado nos logs:**
- ✅ `data[0]?.ownerJid` = `"5516994213312@s.whatsapp.net"`

### Solução

Atualizar a função `fetchPhoneNumber` para buscar o campo `ownerJid` diretamente do primeiro elemento do array.

### Mudanças Necessárias

#### Arquivo: `supabase/functions/whatsapp-connect/index.ts`

Atualizar a função `fetchPhoneNumber`:

```typescript
async function fetchPhoneNumber(instanceName: string): Promise<string | null> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) return null
  
  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${instanceName}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    )
    const data = await response.json()
    
    console.log('[whatsapp-connect] fetchInstances response:', JSON.stringify(data).substring(0, 500))
    
    // Estrutura real: data[0].ownerJid = "5516994213312@s.whatsapp.net"
    const ownerJid = data[0]?.ownerJid
    
    console.log('[whatsapp-connect] Extracted ownerJid:', ownerJid)
    
    if (ownerJid) {
      const phoneRaw = ownerJid.split('@')[0]
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

### Resultado Esperado

O número `5516994213312` será formatado como:
- **+55 (16) 99421-3312**

E exibido na interface ao lado de "Conectado desde:"

### Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/whatsapp-connect/index.ts` | Corrigir caminho para `data[0]?.ownerJid` |

