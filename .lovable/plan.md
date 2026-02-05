
## Plano: Corrigir Sincronização de Dados do Meta Ads

### Problemas Identificados

Analisando os dados do banco e os logs da edge function, encontrei **3 problemas principais**:

| Problema | Meta Ads Manager | Relatório CRM | Causa |
|----------|------------------|---------------|-------|
| Gasto Total | R$ 1.827,05 | R$ 1.484,68 | Falta paginação na API |
| Leads | 83 | 62 | Dados não paginados |
| Impressões | 61.552 | 42.125 | Dados incompletos |
| Dias sincronizados | 30 dias (06/01 - 04/02) | 25 dias (06/01 - 30/01) | API retorna max 25 itens por página |

**Evidências nos logs:**
```
"Saved 25 days of insights" ← deveria ter 30 dias
"Fetched 25 ad-level insights" ← provavelmente há mais páginas
```

### Causa Raiz

A API do Meta retorna resultados **paginados** (máximo ~25 itens por página). O código atual:
1. Faz apenas UMA requisição
2. Ignora o campo `paging.next` da resposta
3. Não busca as páginas seguintes

### Solução Proposta

#### 1. Implementar Paginação na Edge Function

Modificar `supabase/functions/meta-insights/index.ts` para buscar TODAS as páginas:

```typescript
// Função auxiliar para buscar todas as páginas
async function fetchAllPages(initialUrl: string): Promise<any[]> {
  const allData: any[] = [];
  let url = initialUrl;
  
  while (url) {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      console.error('Meta API error:', data.error);
      break;
    }
    
    if (data.data) {
      allData.push(...data.data);
    }
    
    // Verificar se há próxima página
    url = data.paging?.next || null;
  }
  
  return allData;
}
```

#### 2. Aplicar Paginação em TODAS as Chamadas

Modificar as 3 chamadas à API do Meta:

**a) Insights de conta (diários):**
```typescript
const insightsUrl = `https://graph.facebook.com/v19.0/${adAccountId}/insights?` +
  `fields=spend,impressions,clicks,reach,cpm,cpc,actions&` +
  `time_range={"since":"${startDate}","until":"${endDate}"}&` +
  `time_increment=1&` +
  `access_token=${accessToken}`;

const allInsights = await fetchAllPages(insightsUrl);
```

**b) Insights de campanha:**
```typescript
const campaignsUrl = `https://graph.facebook.com/v19.0/${adAccountId}/insights?` +
  `fields=campaign_id,campaign_name,spend,impressions,clicks,reach,actions&` +
  `time_range={"since":"${startDate}","until":"${endDate}"}&` +
  `level=campaign&` +
  `access_token=${accessToken}`;

const allCampaigns = await fetchAllPages(campaignsUrl);
```

**c) Insights de anúncio (por dia):**
```typescript
const adsUrl = `https://graph.facebook.com/v19.0/${adAccountId}/insights?` +
  `fields=ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks,reach,actions&` +
  `time_range={"since":"${startDate}","until":"${endDate}"}&` +
  `level=ad&` +
  `time_increment=1&` +
  `access_token=${accessToken}`;

const allAdInsights = await fetchAllPages(adsUrl);
```

#### 3. Melhorar o Batch Insert

Substituir inserts individuais por batch insert para performance:

```typescript
// Coletar todos os insights de anúncios
const adInsightsToUpsert = [];

for (const adInsight of allAdInsights) {
  // ... processar dados ...
  adInsightsToUpsert.push(processedData);
}

// Inserir em batches de 100
const BATCH_SIZE = 100;
for (let i = 0; i < adInsightsToUpsert.length; i += BATCH_SIZE) {
  const batch = adInsightsToUpsert.slice(i, i + BATCH_SIZE);
  await supabase.from('meta_ad_insights_by_ad').upsert(batch, {
    onConflict: 'account_id,date,ad_id'
  });
}
```

#### 4. Corrigir Aba de Imóveis

A aba de Imóveis depende dos dados de `meta_ad_insights_by_ad` com `form_id`. Após a paginação funcionar:
- Mais registros de anúncios serão salvos
- Mais `form_id` serão vinculados através dos leads
- O cálculo de investimento por imóvel será mais preciso

---

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/meta-insights/index.ts` | Adicionar função de paginação e aplicar em todas as chamadas |

---

### Resultado Esperado Após Correção

| Métrica | Antes | Depois |
|---------|-------|--------|
| Dias sincronizados | 25 | 30 (todos) |
| Gasto Total | R$ 1.484,68 | R$ 1.827,05 |
| Leads | 62 | 83 |
| Impressões | 42.125 | 61.552 |
| Ad insights salvos | 25 | ~100+ (todos anúncios x dias) |

---

### Considerações Técnicas

1. **Rate Limits**: A paginação faz múltiplas requisições, mas o Meta permite ~200 requests/hora por app
2. **Timeout**: Edge functions têm timeout de 150s, suficiente para ~10 páginas
3. **Retry**: Se houver erro em uma página, o processo para mas os dados já salvos ficam
4. **Idempotência**: Usando UPSERT, re-sincronizar não duplica dados
