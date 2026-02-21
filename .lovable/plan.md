

## Corrigir Duplicacao entre "Dados do Formulario" e "Informacoes Adicionais"

### Causa do Problema

Quando um lead chega pelo Meta (Facebook), os campos do formulario sao salvos em **duas tabelas** simultaneamente:
- `lead_form_field_values` (tabela dos dados de formulario)
- `lead_custom_field_values` (tabela dos campos personalizados)

Isso acontece intencionalmente no `meta-webhook` para que as variaveis `{form_*}` funcionem nos templates de mensagem. Porem, na UI, ambos os componentes exibem os mesmos dados, causando a duplicacao visivel.

### Solucao

Alterar o componente `LeadCustomFields.tsx` para que ele **exclua campos cujos `field_key` ja existem em `lead_form_field_values`** do mesmo lead. Assim:

- **"Dados do Formulario"** mostra as perguntas e respostas que vieram diretamente do formulario (Meta, webhook, etc.)
- **"Informacoes Adicionais"** mostra apenas campos personalizados que **nao** estao presentes nos dados do formulario (ex: campos preenchidos manualmente, dados de outras fontes)

### Alteracao Tecnica

**Arquivo: `src/components/LeadCustomFields.tsx`**

Dentro da funcao `fetchData`, apos buscar os campos personalizados e seus valores, tambem buscar os `field_name` da tabela `lead_form_field_values` para o mesmo lead. Depois, filtrar os custom fields removendo aqueles cujo `field_key` corresponde a um `field_name` existente nos form fields.

```
// Pseudocodigo da logica adicionada:
1. Buscar lead_form_field_values.field_name para o lead
2. Criar um Set com esses field_names (lowercase)
3. Filtrar custom_fields removendo os que tem field_key presente nesse Set
```

Isso garante que se um campo ja aparece em "Dados do Formulario", ele nao sera repetido em "Informacoes Adicionais". Campos exclusivos de custom fields (preenchidos manualmente ou de outras fontes) continuarao aparecendo normalmente.

Nenhuma outra alteracao e necessaria -- o componente `LeadFormFields.tsx` permanece inalterado.

