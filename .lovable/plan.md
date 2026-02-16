

## Enriquecer dados de demonstracao da "Imobiliaria Demonstracao"

### Conta identificada
- **Account ID:** `6e7a7df6-a3d8-4775-8a43-3e20704ef985`
- **User ID (unico):** `e4e07296-bd00-4160-af45-5e0a36eca0f0`

### Estado atual
- 8 imoveis (2 vendas fechadas, total ~R$1.2M em VGV)
- 30 leads distribuidos nos 8 status do funil
- 10 eventos na agenda
- **Zero dados de investimento** (meta_ad_insights e meta_ad_insights_by_ad vazios)
- **Zero mapeamento de formularios** (meta_form_property_mapping vazio)
- Apenas 2 leads no status "Fechado"

### O que sera adicionado

---

#### 1. Mais vendas (leads "Fechado") para VGV acima de R$2.5M

Mover/criar leads vinculados a imoveis de alto valor para o status "Fechado":

| Lead | Imovel | Valor Venda | Status |
|---|---|---|---|
| (novo) Ricardo Mendes | Cobertura Duplex Jardins (R$4.2M) | R$4.200.000 | Fechado |
| (novo) Patricia Almeida | Casa 4 Suites Alphaville (R$2.5M) | R$2.500.000 | Fechado |
| (novo) Eduardo Santos | Apt 3 Quartos Itaim (R$1.85M) | R$1.850.000 | Fechado |
| Renata Lima (existente) | Casa 3 Quartos Morumbi (R$1.2M) | R$1.200.000 | Ja fechado |
| Samuel Oliveira (existente) | Conj Comercial Paulista | Aluguel | Ja fechado |

**VGV total: R$4.2M + R$2.5M + R$1.85M + R$1.2M = R$9.75M** (bem acima de R$2.5M)

Os imoveis vendidos terao status atualizado para "vendido" ou "reservado".

---

#### 2. Mais leads distribuidos no funil (~20 novos)

Leads com nomes realistas, vinculados a diferentes imoveis, distribuidos em todos os status:

- **Novo Lead:** 5 novos (criados nos ultimos 2-3 dias)
- **Em Contato:** 4 novos
- **Qualificado:** 3 novos
- **Visita Agendada:** 3 novos
- **Proposta:** 2 novos
- **Negociacao:** 2 novos
- **Perdido:** 1 novo

Temperaturas variadas: mix de hot, warm e cold.

---

#### 3. Investimento em anuncios (meta_ad_insights)

Inserir dados diarios nos ultimos 30 dias com media de ~R$100/dia (total ~R$3.000):

- 30 registros em `meta_ad_insights` (1 por dia)
- Metricas: spend (~R$80-120/dia), impressions, clicks, leads_count, CPL, CPC, CPM
- Total acumulado: ~R$3.000

---

#### 4. Investimento por anuncio/imovel (meta_ad_insights_by_ad)

Inserir dados vinculando gastos a formularios especificos para que o CPL por imovel funcione nos relatorios:

- Criar mapeamentos em `meta_form_property_mapping` ligando form_ids ficticios aos reference_codes dos imoveis
- Inserir dados em `meta_ad_insights_by_ad` com os mesmos form_ids
- Distribuir o gasto entre os imoveis principais (Cobertura Jardins, Alphaville, Itaim, etc.)

---

#### 5. Eventos na agenda (proximos 7-14 dias)

Adicionar ~15 novos eventos variados:

- **Visitas a imoveis** (8 eventos) - vinculados a leads e imoveis especificos
- **Reunioes com clientes** (3 eventos)
- **Follow-ups** (3 eventos)
- **Assinatura de contrato** (1 evento)

Distribuidos ao longo dos proximos 14 dias, em horarios comerciais variados.

---

#### 6. Atualizar status de imoveis vendidos

- Cobertura Duplex Jardins: `vendido`
- Casa 4 Suites Alphaville: `reservado`
- Apt 3 Quartos Itaim Bibi: `vendido`

---

### Detalhes tecnicos

Todas as insercoes serao feitas via SQL usando a ferramenta de insercao de dados (nao migracao de schema). As queries serao executadas na seguinte ordem:

1. Inserir novos leads (~20 registros em `leads`)
2. Atualizar imoveis vendidos (UPDATE em `properties`)
3. Inserir mapeamentos de formularios (`meta_form_property_mapping`)
4. Inserir dados de investimento diario (`meta_ad_insights` - 30 dias)
5. Inserir dados de investimento por anuncio (`meta_ad_insights_by_ad` - 30 dias x 4 imoveis)
6. Inserir eventos na agenda (`events` - ~15 eventos)

Todos os registros usarao `account_id = '6e7a7df6-a3d8-4775-8a43-3e20704ef985'`.

