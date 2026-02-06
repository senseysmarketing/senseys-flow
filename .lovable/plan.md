

## Plano de Correção do Erro de URL da Evolution API

### Problema Identificado

O erro `Invalid URL: 'senseys-evolution.cloudfy.cloud/instance/create'` ocorre porque a variável de ambiente `EVOLUTION_API_URL` está configurada **sem o protocolo HTTPS**.

| Valor Atual | Valor Esperado |
|-------------|----------------|
| `senseys-evolution.cloudfy.cloud` | `https://senseys-evolution.cloudfy.cloud` |

### Solução

Há duas abordagens para resolver:

#### Opção 1: Corrigir o Secret (Recomendado)

Atualizar o valor do secret `EVOLUTION_API_URL` para incluir o protocolo:

```
https://senseys-evolution.cloudfy.cloud
```

Esta é a solução mais limpa pois segue a convenção padrão de URLs.

#### Opção 2: Adicionar Fallback no Código

Modificar a edge function para garantir que o protocolo seja adicionado caso esteja faltando:

```typescript
// DE (linha 8):
const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || ''

// PARA:
const rawEvolutionUrl = Deno.env.get('EVOLUTION_API_URL') || ''
const EVOLUTION_API_URL = rawEvolutionUrl.startsWith('http') 
  ? rawEvolutionUrl 
  : `https://${rawEvolutionUrl}`
```

### Recomendação

**Aplicar ambas as soluções**:

1. **Corrigir o secret** para ter a URL completa com `https://`
2. **Adicionar fallback no código** para prevenir esse tipo de erro no futuro

### Mudanças Necessárias

| Arquivo | Tipo de Mudança |
|---------|-----------------|
| Secret `EVOLUTION_API_URL` | Atualizar valor para `https://senseys-evolution.cloudfy.cloud` |
| `supabase/functions/whatsapp-connect/index.ts` | Adicionar fallback de protocolo na linha 8 |

### Impacto

- **Risco**: Muito baixo - correção simples de configuração
- **Tempo estimado**: 2 minutos
- **Benefício**: WhatsApp connect funcionará corretamente

