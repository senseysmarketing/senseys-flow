
## Adicionar Metricas de Investimento e Funil Comercial ao Modal de Detalhes do Imovel

### Problema Atual

O modal de detalhes do imovel calcula o CPL usando apenas o campo manual `property.campaign_cost`, que esta vazio/desatualizado. O investimento real vem do Meta Ads (tabela `meta_ad_insights_by_ad`) vinculado via `meta_form_property_mapping` pelo `reference_code` do imovel -- essa logica ja funciona corretamente no card `PropertyMetricsCard.tsx` mas nao foi replicada no modal.

### Solucao

Modificar `PropertyDetailModal.tsx` para:

1. **Buscar investimento real do Meta Ads** usando a mesma logica do `PropertyMetricsCard` (via `reference_code` -> `meta_form_property_mapping` -> `meta_ad_insights_by_ad`)
2. **Calcular CPL real** baseado nesse investimento
3. **Adicionar novas metricas de funil comercial** para maior previsibilidade

### Novas Metricas no Modal

A grade de KPIs sera expandida para incluir:

| Metrica | Descricao |
|---------|-----------|
| Total Leads | Ja existe |
| Quentes | Ja existe |
| Mornos | Novo - leads com temperatura "warm" |
| Frios | Novo - leads com temperatura "cold" |
| Visitas | Ja existe |
| Dias no Mercado | Ja existe |
| Investimento | **Novo** - valor total gasto em anuncios (Meta Ads) |
| CPL | **Corrigido** - calculado com investimento real |
| Conversao | Ja existe |
| Leads Fechados | Novo - quantidade absoluta |
| Custo por Venda | Novo - investimento / leads fechados |
| Em Contato | Novo - leads no status "Em Contato" |

### Secao de Funil Comercial (Nova)

Abaixo dos KPIs, uma nova secao visual mostrara o funil:

```text
Novo Lead (X) -> Em Contato (X) -> Qualificado (X) -> Visita (X) -> Proposta (X) -> Fechado (X)
```

Cada etapa mostrara a quantidade de leads e a taxa de conversao entre etapas.

### Secao de Investimento (Atualizada)

A secao "Campanha" sera substituida por uma secao "Investimento em Anuncios" que mostra:
- Investimento total (ultimos 30 dias)
- CPL (custo por lead)
- Custo por venda (investimento / fechados)
- Formularios vinculados (quantidade)

### Arquivo a Modificar

**`src/components/PropertyDetailModal.tsx`**

### Mudancas Tecnicas

1. **Novo state** para `adInvestment` (number) e `formCount` (number)
2. **Nova funcao** `fetchAdInvestment()` chamada dentro de `fetchPropertyData()`:
   - Busca `meta_form_property_mapping` pelo `reference_code` do imovel
   - Agrega `spend` de `meta_ad_insights_by_ad` dos ultimos 30 dias
3. **Calculo do CPL** passa a usar `adInvestment` ao inves de `campaign_cost`
4. **Contagem de leads por status** para montar o funil comercial
5. **Novas metricas derivadas**: custo por venda, leads mornos/frios, taxa entre etapas do funil
6. **UI atualizada**: grid de KPIs reorganizado + secao de funil + secao de investimento melhorada
