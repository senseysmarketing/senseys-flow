

## Plano: Grafico de Motivos de Desqualificacao na Aba Leads

### Visao Geral

Adicionar uma secao na aba "Leads" da pagina de Relatorios com um grafico de barras horizontais mostrando os motivos de desqualificacao mais frequentes no periodo selecionado. Isso permite identificar padroes de perda e qualidade das campanhas.

### Arquivo a Modificar

**`src/pages/Reports.tsx`**

### Mudancas

#### 1. Novo estado para dados de desqualificacao

Adicionar estado `disqualificationStats` com array `{ reason: string; label: string; count: number }[]`.

#### 2. Nova funcao `fetchDisqualificationStats`

- Consultar `lead_disqualification_reasons` filtrado pelo periodo selecionado (`created_at` entre `dateFrom` e `dateTo`)
- Extrair o campo `reasons` (jsonb array) de cada registro
- Contar a frequencia de cada motivo
- Mapear as keys para labels legíveis usando a constante `DISQUALIFICATION_REASONS` exportada do `DisqualifyLeadModal`

```typescript
import { DISQUALIFICATION_REASONS } from "@/components/leads/DisqualifyLeadModal";

const fetchDisqualificationStats = async () => {
  const { from: dateFrom, to: dateTo } = getDateRange();
  const { data, error } = await supabase
    .from("lead_disqualification_reasons")
    .select("reasons")
    .gte("created_at", parseISO(dateFrom).toISOString())
    .lte("created_at", parseISO(dateTo).toISOString());

  if (error || !data) return;

  const counts: Record<string, number> = {};
  data.forEach(row => {
    const reasons = row.reasons as string[];
    reasons.forEach(r => { counts[r] = (counts[r] || 0) + 1; });
  });

  const stats = Object.entries(counts)
    .map(([key, count]) => ({
      reason: key,
      label: DISQUALIFICATION_REASONS.find(r => r.key === key)?.label || key,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  setDisqualificationStats(stats);
};
```

#### 3. Chamar no `fetchStats`

Adicionar `fetchDisqualificationStats()` ao `Promise.all` existente junto com as outras funcoes de fetch.

#### 4. Novo Card na aba Leads

Adicionar um `Card` apos o grafico de "Evolucao de Leads" (antes do fechamento da `TabsContent`), com:
- Titulo: "Motivos de Desqualificacao"
- Descricao: "Principais motivos de perda de leads no periodo"
- Grafico de barras horizontais (`BarChart` com `layout="vertical"`)
- Cor vermelha/destrutiva para as barras
- Mensagem vazia quando nao ha dados

```text
+-------------------------------------------+
| Motivos de Desqualificacao                |
| Principais motivos de perda no periodo    |
|                                           |
|  Nao responde          ████████████  12   |
|  Sem interesse         ████████     8     |
|  Dados invalidos       ██████       6     |
|  Comprou concorrente   ████         4     |
|  Desistiu              ██           2     |
+-------------------------------------------+
```

### Detalhes Tecnicos

- Reutiliza a constante `DISQUALIFICATION_REASONS` ja exportada de `DisqualifyLeadModal.tsx`
- Respeita o periodo global selecionado (7, 30, 90 dias ou custom)
- Usa o mesmo padrao de `BarChart` horizontal ja presente na aba (ex: "Leads por Origem")
- Importa `XCircle` de lucide-react para o icone do titulo do card

### Resultado

- Visao clara dos motivos mais frequentes de perda de leads
- Dados filtrados pelo periodo selecionado
- Permite identificar problemas recorrentes (ex: muitos "dados invalidos" indica problema na campanha)
- Informacao acionavel para melhorar a qualidade dos leads e das campanhas

