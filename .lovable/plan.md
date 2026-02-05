
## Plano: Buscar Insights do Meta a Nível de Anúncio e Vincular ao Formulário/Imóvel

### Objetivo

Modificar a sincronização de insights do Meta para buscar dados a nível de **anúncio** (em vez de apenas campanha), permitindo calcular o investimento e CPL **exato** por formulário e, consequentemente, por imóvel.

---

### Contexto Atual

**Dados disponíveis nos leads:**
| Campo | Exemplo | Descrição |
|-------|---------|-----------|
| `meta_form_id` | `1162439922641716` | ID do formulário do Meta |
| `meta_ad_id` | `6886331767333` | ID do anúncio que gerou o lead |
| `property_id` | `05959c37-a5b2-...` | Imóvel vinculado ao lead |

**Sincronização atual (`meta-insights`):**
- Busca insights a nível de **conta** (totais diários)
- Busca insights a nível de **campanha** (armazenado em `campaign_data` JSONB)
- **NÃO** busca insights a nível de **anúncio**

**Vínculo formulário → imóvel:**
- Leads com mesmo `meta_form_id` geralmente pertencem ao mesmo imóvel
- Exemplo: `form_id: 1162439922641716` → 22 leads → imóvel `AP0189-OSWG`

---

### Solução Proposta

#### 1. Criar Nova Tabela: `meta_ad_insights_by_ad`

Armazenar insights granulares por anúncio:

```sql
CREATE TABLE meta_ad_insights_by_ad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  date DATE NOT NULL,
  ad_id TEXT NOT NULL,
  ad_name TEXT,
  adset_id TEXT,
  adset_name TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  form_id TEXT,                -- Extraído do lead_gen_id ou cruzamento
  spend NUMERIC DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  leads_count INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  cpm NUMERIC DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  cpl NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, date, ad_id)
);

-- Índices para consultas rápidas
CREATE INDEX idx_ad_insights_account_date ON meta_ad_insights_by_ad(account_id, date);
CREATE INDEX idx_ad_insights_form_id ON meta_ad_insights_by_ad(form_id);
CREATE INDEX idx_ad_insights_ad_id ON meta_ad_insights_by_ad(ad_id);
```

#### 2. Modificar Edge Function `meta-insights`

**Adicionar nova chamada à API do Meta (nível anúncio):**

```typescript
// Buscar insights a nível de anúncio
const adsResponse = await fetch(
  `https://graph.facebook.com/v19.0/${adAccountId}/insights?` +
  `fields=ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks,reach,actions&` +
  `time_range={"since":"${startDate}","until":"${endDate}"}&` +
  `level=ad&` +  // <-- NOVO: nível de anúncio
  `time_increment=1&` +
  `access_token=${accessToken}`
);
```

**Processar e salvar dados por anúncio:**

```typescript
for (const adInsight of adsData.data || []) {
  const leadsAction = adInsight.actions?.find(a => a.action_type === 'lead');
  const leadsCount = leadsAction?.value ? parseInt(leadsAction.value) : 0;
  const spend = parseFloat(adInsight.spend || '0');
  
  // Tentar encontrar form_id através dos leads com este ad_id
  const { data: leadWithForm } = await supabase
    .from('leads')
    .select('meta_form_id')
    .eq('meta_ad_id', adInsight.ad_id)
    .not('meta_form_id', 'is', null)
    .limit(1)
    .single();
  
  await supabase.from('meta_ad_insights_by_ad').upsert({
    account_id: targetAccountId,
    date: adInsight.date_start,
    ad_id: adInsight.ad_id,
    ad_name: adInsight.ad_name,
    adset_id: adInsight.adset_id,
    adset_name: adInsight.adset_name,
    campaign_id: adInsight.campaign_id,
    campaign_name: adInsight.campaign_name,
    form_id: leadWithForm?.meta_form_id || null,
    spend,
    impressions: parseInt(adInsight.impressions || '0'),
    clicks: parseInt(adInsight.clicks || '0'),
    leads_count: leadsCount,
    reach: parseInt(adInsight.reach || '0'),
    cpm: parseFloat(adInsight.cpm || '0'),
    cpc: parseFloat(adInsight.cpc || '0'),
    cpl: leadsCount > 0 ? spend / leadsCount : 0,
  }, { onConflict: 'account_id,date,ad_id' });
}
```

#### 3. Atualizar Relatório de Imóveis (`Reports.tsx`)

**Nova lógica de cálculo:**

```typescript
// 1. Buscar insights por anúncio no período
const { data: adInsights } = await supabase
  .from('meta_ad_insights_by_ad')
  .select('form_id, spend, leads_count')
  .gte('date', dateFrom)
  .lte('date', dateTo);

// 2. Agregar por form_id
const spendByFormId = new Map<string, number>();
for (const insight of adInsights || []) {
  if (insight.form_id) {
    const current = spendByFormId.get(insight.form_id) || 0;
    spendByFormId.set(insight.form_id, current + (insight.spend || 0));
  }
}

// 3. Para cada imóvel, buscar leads e somar investimento dos forms
for (const property of properties) {
  // Buscar form_ids dos leads deste imóvel
  const propertyFormIds = leads
    .filter(l => l.property_id === property.id && l.meta_form_id)
    .map(l => l.meta_form_id);
  
  const uniqueFormIds = [...new Set(propertyFormIds)];
  
  // Somar investimento de todos os forms do imóvel
  let campaignCost = 0;
  for (const formId of uniqueFormIds) {
    campaignCost += spendByFormId.get(formId) || 0;
  }
  
  const cpl = leadCount > 0 ? campaignCost / leadCount : 0;
}
```

---

### Fluxo de Dados

```text
┌─────────────────────────────────────────────────────────────────┐
│                         META ADS API                            │
│  GET /{ad_account_id}/insights?level=ad                        │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   meta_ad_insights_by_ad                        │
│  ad_id │ form_id │ spend │ impressions │ leads_count │ date    │
│  6886..│ 1162... │ 150.0 │ 5000       │ 3           │ 2026-02-01│
└────────────────────────────────────────────────────────────────┘
                              │
      ┌───────────────────────┼───────────────────────┐
      │                       │                       │
      ▼                       ▼                       ▼
┌──────────────┐      ┌──────────────┐       ┌──────────────┐
│    leads     │      │meta_form_    │       │  properties  │
│ meta_form_id │ ──── │ configs      │       │              │
│ property_id  │──────│ form_id      │───────│ reference_   │
│              │      │              │       │ code         │
└──────────────┘      └──────────────┘       └──────────────┘
```

---

### Arquivos a Modificar/Criar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| **Migration SQL** | Criar | Nova tabela `meta_ad_insights_by_ad` |
| `supabase/functions/meta-insights/index.ts` | Modificar | Adicionar busca `level=ad` e salvar na nova tabela |
| `src/pages/Reports.tsx` | Modificar | Usar nova tabela para calcular investimento por imóvel |

---

### Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Investimento por Imóvel | R$ 0,00 (manual) | R$ 1.523,45 (calculado do Meta por anúncio/form) |
| CPL por Imóvel | R$ 0,00 | R$ 22,73 (investimento real ÷ leads reais) |
| Precisão | Distribuição proporcional | Dados exatos por anúncio vinculado ao formulário |

---

### Considerações Técnicas

1. **Volume de dados**: Insights por anúncio podem gerar mais registros, mas a API do Meta suporta paginação
2. **Vínculo form_id**: O form_id não vem diretamente no insight, mas conseguimos inferir através dos leads que têm aquele `ad_id`
3. **Período de sincronização**: Manter os mesmos 30 dias padrão
4. **Retrocompatibilidade**: A tabela antiga `meta_ad_insights` continua funcionando para a aba "Anúncios"
