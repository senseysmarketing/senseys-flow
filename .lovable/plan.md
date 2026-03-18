

## Exportar Leads Filtrados como Planilha Excel

### Objetivo
Adicionar uma opção "Exportar Leads" no `LeadsSettingsSheet` que exporta os leads atualmente filtrados em um arquivo `.xlsx` organizado, usando a biblioteca `xlsx` (já instalada no projeto).

### Mudanças

#### 1. `src/components/leads/LeadsExport.tsx` — Reescrever com export Excel

- Substituir o export CSV por export `.xlsx` usando a lib `xlsx` (já usada em `csv-parser.ts`)
- Nova função `exportLeadsToExcel(leads: Lead[])`:
  - Gera uma planilha com headers formatados em português
  - Inclui todos os campos: Nome, Telefone, Email, Status, Temperatura, Origem, Interesse, Imóvel, Campanha, Conjunto, Anúncio, Observações, Corretor (assigned\_broker\_id — precisaremos passar o nome), Criado em, Atualizado em
  - Ajusta largura automática das colunas (`!cols` com `wch`)
  - Nome do arquivo: `leads_YYYY-MM-DD_HH-MM.xlsx`
- Manter `exportLeadsToCSV` como fallback mas adicionar a nova como default

#### 2. `src/components/leads/LeadsSettingsSheet.tsx` — Adicionar item "Exportar"

- Adicionar novo item no array `settingsItems`:
  ```
  { id: "export", icon: Download, label: "Exportar Leads", description: "Exporte os leads filtrados em planilha Excel" }
  ```
- Esse item **não abre um modal** — ele executa a exportação diretamente
- Precisa receber os `filteredLeads` como prop para exportar com filtros aplicados
- Atualizar `LeadsSettingsSheetProps` com `filteredLeads?: Lead[]`
- No `handleItemClick`, se `tab === "export"`, chamar `exportLeadsToExcel(filteredLeads)` + toast + fechar sheet

#### 3. `src/pages/Leads.tsx` — Passar filteredLeads ao Sheet

- Passar `filteredLeads` como prop para `<LeadsSettingsSheet>`:
  ```tsx
  <LeadsSettingsSheet filteredLeads={filteredLeads} />
  ```

### Detalhes da Planilha

- Headers na primeira linha com estilo bold (via xlsx)
- Colunas com largura automática baseada no conteúdo
- Telefone formatado como texto (evitar interpretação numérica)
- Temperatura traduzida (hot→Quente, warm→Morno, cold→Frio)
- Datas formatadas em pt-BR

