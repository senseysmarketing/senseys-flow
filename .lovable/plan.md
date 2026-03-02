

## Mostrar valores de referência recebidos na qualificação

### Problema

A seção "Valores de código de referência recebidos" aparece vazia porque o código atual (linha 885) tenta buscar os valores do array `rules` (regras de pontuação), mas campos de referência como `ref` são campos de texto livre -- eles nunca geram entradas em `meta_form_scoring_rules`. Os valores reais estão na tabela `lead_form_field_values`.

### Solução

1. **Ampliar a busca de dados** no `fetchData` do `MetaFormScoringManager.tsx`:
   - Além de buscar os nomes dos campos de referência (`field_name`), buscar também os **valores distintos** (`field_value`) de `lead_form_field_values` para cada formulário.
   - Armazenar num novo state `formFieldRefValues` no formato `Record<configId, string[]>` (valores únicos).

2. **Atualizar a seção de exibição** (linhas 882-894):
   - Em vez de buscar valores em `rules`, usar o novo `formFieldRefValues[config.id]` para listar os códigos de referência reais recebidos (ex: "ABC123", "XYZ789").
   - Limitar a exibição aos últimos ~20 valores distintos para não sobrecarregar a interface.

### Detalhes técnicos

| Arquivo | Mudança |
|---------|---------|
| `src/components/MetaFormScoringManager.tsx` | Adicionar state `formFieldRefValues`, query de valores distintos no `fetchData`, e atualizar o render dos badges |

A query adicional será algo como:
```sql
SELECT DISTINCT field_value FROM lead_form_field_values
WHERE lead_id IN (leads do form) AND field_name IN (ref fields detectados)
LIMIT 20
```

