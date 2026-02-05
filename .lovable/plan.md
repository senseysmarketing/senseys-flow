
## Plano: Vincular Investimento por REF do Imóvel

### Entendimento do Problema

**Situação Atual:**
- A lógica busca `form_id` através de leads existentes com aquele `ad_id`
- Se um anúncio não gerou lead ainda, o gasto não é vinculado ao imóvel
- Múltiplos formulários com a mesma REF não são agrupados

**Dados encontrados:**
| Métrica | Valor |
|---------|-------|
| Ad insights COM form_id | 67 registros (36%) |
| Ad insights SEM form_id | 117 registros (64%) |
| Form_ids únicos com gastos | 5 apenas |
| Mapeamentos form→ref existentes | 20+ (via leads) |

### Solução Proposta

Criar uma tabela de mapeamento persistente entre `form_id` e `reference_code`, que será atualizada automaticamente quando leads chegam. Na aba de Imóveis, buscar investimento usando a `reference_code` do imóvel.

```text
┌─────────────────┐     ┌──────────────────────┐     ┌───────────────────┐
│  properties     │     │  meta_form_property_ │     │  meta_ad_insights │
│  (reference_code)│◄───│  mapping             │────►│  _by_ad           │
└─────────────────┘     │  (form_id ↔ ref)     │     │  (form_id, spend) │
                        └──────────────────────┘     └───────────────────┘
                                  ▲
                                  │ Populado quando lead chega
                        ┌─────────┴─────────┐
                        │  meta-webhook     │
                        └───────────────────┘
```

### Implementação

#### 1. Migration: Criar Tabela de Mapeamento

```sql
CREATE TABLE meta_form_property_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  form_id TEXT NOT NULL,
  form_name TEXT,
  reference_code TEXT NOT NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, form_id)
);

-- Índices
CREATE INDEX idx_form_mapping_account ON meta_form_property_mapping(account_id);
CREATE INDEX idx_form_mapping_ref ON meta_form_property_mapping(reference_code);

-- RLS
ALTER TABLE meta_form_property_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account mappings"
  ON meta_form_property_mapping FOR SELECT
  USING (account_id IN (SELECT account_id FROM profiles WHERE user_id = auth.uid()));

-- Popular com dados existentes dos leads
INSERT INTO meta_form_property_mapping (account_id, form_id, reference_code, property_id)
SELECT DISTINCT ON (l.account_id, l.meta_form_id)
  l.account_id,
  l.meta_form_id,
  p.reference_code,
  l.property_id
FROM leads l
JOIN properties p ON l.property_id = p.id
WHERE l.meta_form_id IS NOT NULL
  AND p.reference_code IS NOT NULL
ORDER BY l.account_id, l.meta_form_id, l.created_at DESC
ON CONFLICT DO NOTHING;
```

#### 2. Atualizar meta-webhook

Após criar o lead e vincular ao imóvel, salvar o mapeamento:

```typescript
// Após linha 540 (lead criado com sucesso)
if (formId && propertyId && referenceCode) {
  await supabase.from('meta_form_property_mapping').upsert({
    account_id: metaConfig.account_id,
    form_id: formId,
    reference_code: referenceCode,
    property_id: propertyId
  }, { onConflict: 'account_id,form_id' });
  console.log(`✅ Saved form mapping: ${formId} -> ${referenceCode}`);
}
```

#### 3. Atualizar Reports.tsx (fetchPropertyStats)

Nova lógica para buscar investimento por reference_code:

```typescript
const fetchPropertyStats = async () => {
  const { from: dateFrom, to: dateTo } = getDateRange();

  // 1. Buscar propriedades COM reference_code
  const { data: properties } = await supabase
    .from("properties")
    .select("id, title, type, status, campaign_cost, reference_code");

  // 2. Buscar mapeamentos form_id → reference_code
  const { data: formMappings } = await supabase
    .from("meta_form_property_mapping")
    .select("form_id, reference_code");

  // 3. Buscar todos os ad insights COM form_id no período
  const { data: adInsights } = await supabase
    .from("meta_ad_insights_by_ad")
    .select("form_id, spend")
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .not("form_id", "is", null);

  // 4. Agregar spend por reference_code (não por form_id individual)
  const spendByRef = new Map<string, number>();
  for (const insight of adInsights || []) {
    const mapping = formMappings?.find(m => m.form_id === insight.form_id);
    if (mapping?.reference_code) {
      const current = spendByRef.get(mapping.reference_code) || 0;
      spendByRef.set(mapping.reference_code, current + Number(insight.spend || 0));
    }
  }

  // 5. Buscar leads do período
  const { data: leads } = await supabase
    .from("leads")
    .select("property_id, temperature")
    .not("property_id", "is", null)
    .gte("created_at", `${dateFrom}T00:00:00`)
    .lte("created_at", `${dateTo}T23:59:59`);

  // 6. Calcular stats usando reference_code para investimento
  const stats = properties.map(prop => {
    const propLeads = leads?.filter(l => l.property_id === prop.id) || [];
    
    // Investimento vem da reference_code, não dos leads individuais
    const campaignCost = prop.reference_code 
      ? (spendByRef.get(prop.reference_code) || 0)
      : (prop.campaign_cost || 0);
    
    const cpl = propLeads.length > 0 ? campaignCost / propLeads.length : 0;

    return {
      id: prop.id,
      title: prop.title,
      type: prop.type,
      status: prop.status || 'disponivel',
      leadCount: propLeads.length,
      hotLeads: propLeads.filter(l => l.temperature === 'hot').length,
      warmLeads: propLeads.filter(l => l.temperature === 'warm').length,
      coldLeads: propLeads.filter(l => l.temperature === 'cold').length,
      campaignCost,
      cpl
    };
  });

  setPropertyStats(stats);
};
```

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| **Nova migration** | Criar tabela `meta_form_property_mapping` e popular com dados existentes |
| `supabase/functions/meta-webhook/index.ts` | Salvar mapeamento form→ref ao criar lead |
| `src/pages/Reports.tsx` | Buscar investimento via reference_code da tabela de mapeamento |

### Resultado Esperado

| Antes | Depois |
|-------|--------|
| Investimento vinculado por ad_id→lead→form_id | Investimento vinculado por form_id→reference_code→property |
| Múltiplos forms mesma REF: parcial | Múltiplos forms mesma REF: soma completa |
| Só contabiliza se tiver lead no anúncio | Contabiliza todo gasto de forms mapeados |
| Gastos não-formulário aparecem em Imóveis | Gastos não-formulário ficam apenas em relatório geral |

### Observação Importante

Gastos de campanhas que **não são de formulário** (engajamento, alcance, etc.) continuarão aparecendo nos relatórios gerais (aba Anúncios), mas **não aparecerão** na aba de Imóveis. Isso está correto, pois essas campanhas não têm `form_id` e não podem ser vinculadas a imóveis específicos.
