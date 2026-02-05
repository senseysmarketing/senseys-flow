
## Plano: Corrigir Recálculo de Temperatura dos Leads

### Problema Identificado

Quando o usuário salva ajustes nas pontuações de um formulário e marca a opção "Atualizar leads existentes", a edge function `recalculate-lead-temperatures` não encontra correspondência entre as regras de scoring e os valores dos leads, resultando em **pontuação total = 0** para todos os leads, que são classificados como "cold" (frios).

### Causa Raiz (3 bugs)

| Bug | Onde Ocorre | Impacto |
|-----|-------------|---------|
| **1. Tabela errada** | `recalculate-lead-temperatures` busca em `lead_custom_field_values` | Não encontra dados (tabela quase vazia) |
| **2. Nomes não batem** | Regras: `quando_pretende_comprar?` vs Leads: `quando_pretende_comprar` | Match falha por causa do `?` no final |
| **3. Valores não batem** | Regras: `Nos próximos 3 meses` vs Leads: `nos_próximos_3_meses` | Match falha por formato diferente |

### Dados Comprobatórios

```sql
-- Regras de scoring (meta_form_scoring_rules):
question_name: "quando_pretende_comprar?"
answer_value: "Nos próximos 3 meses"

-- Valores do lead (lead_form_field_values):  
field_name: "quando_pretende_comprar"  -- SEM interrogação
field_value: "nos_próximos_3_meses"    -- snake_case minúsculo
```

O webhook `webhook-leads` já tem a função `normalizeForComparison` que resolve isso, mas a edge function `recalculate-lead-temperatures` não a utiliza.

---

### Solução

Reescrever a edge function `recalculate-lead-temperatures` para:

1. **Buscar dados da tabela correta**: `lead_form_field_values` em vez de `lead_custom_field_values`
2. **Usar normalização**: Aplicar a mesma função `normalizeForComparison` do webhook
3. **Comparar corretamente**: Normalizar tanto `question_name` ↔ `field_name` quanto `answer_value` ↔ `field_value`

---

### Mudanças Técnicas

#### Arquivo: `supabase/functions/recalculate-lead-temperatures/index.ts`

**Adicionar função de normalização:**
```typescript
// Normalize values for comparison (handles snake_case vs readable format)
const normalizeForComparison = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')     // underscores -> spaces
    .replace(/\?/g, '')     // remove question marks
    .replace(/\s+/g, ' ')   // multiple spaces -> single space
    .trim();
};
```

**Mudar busca de dados (de tabela errada para correta):**
```typescript
// ANTES (errado):
const { data: fieldValues } = await supabase
  .from('lead_custom_field_values')
  .select('custom_field_id, value')
  .eq('lead_id', lead.id);

// DEPOIS (correto):
const { data: fieldValues } = await supabase
  .from('lead_form_field_values')
  .select('field_name, field_value')
  .eq('lead_id', lead.id);
```

**Mudar comparação (usar normalização):**
```typescript
// ANTES (match exato):
const questionScores = scoringMap.get(customField.field_key);
const score = questionScores.get(fieldValue.value.toLowerCase());

// DEPOIS (match normalizado):
for (const fieldValue of fieldValues) {
  const normalizedFieldName = normalizeForComparison(fieldValue.field_name);
  const normalizedFieldValue = normalizeForComparison(fieldValue.field_value);
  
  // Procurar regra que corresponde (normalizando ambos os lados)
  const matchingRule = scoringRules.find(rule => 
    normalizeForComparison(rule.question_name) === normalizedFieldName &&
    normalizeForComparison(rule.answer_value) === normalizedFieldValue
  );
  
  if (matchingRule) {
    totalScore += matchingRule.score;
  }
}
```

**Remover dependência de custom_fields:**
- A lógica atual busca `custom_fields` para mapear IDs → nomes
- Isso não é necessário porque `lead_form_field_values` já contém `field_name` diretamente

---

### Fluxo Corrigido

```text
1. Usuário ajusta pontuações no formulário
2. Usuário clica "Salvar" com "Atualizar leads existentes" marcado
3. Frontend chama edge function recalculate-lead-temperatures
4. Edge function busca leads pelo meta_form_id
5. Para cada lead:
   a. Busca valores em lead_form_field_values
   b. Normaliza field_name e field_value
   c. Compara com regras normalizadas
   d. Soma pontuação
   e. Aplica thresholds (hot >= X, warm >= Y, else cold)
   f. Atualiza temperatura se mudou
```

---

### Arquivos a Modificar

1. **`supabase/functions/recalculate-lead-temperatures/index.ts`** - Reescrever lógica de cálculo

---

### Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Lead com `quando_pretende_comprar = "imediatamente_(até_30_dias)"` | Score = 0 → Cold | Score = +2 → Hot |
| Match de pergunta com `?` | Não encontra | Encontra (normalizado) |
| Match de resposta snake_case | Não encontra | Encontra (normalizado) |

---

### Testes Recomendados

Após a implementação:
1. Ajustar uma pontuação em um formulário configurado
2. Salvar com "Atualizar leads existentes" marcado
3. Verificar que os leads são recalculados corretamente (não todos frios)
4. Conferir logs da edge function para ver matches encontrados
