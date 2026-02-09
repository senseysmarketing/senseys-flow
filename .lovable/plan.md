

## Plano: Corrigir Nomes de Leads do Facebook

### Problema

Leads de varias contas estao chegando com nome "Lead do Facebook" porque o webhook so verifica 3 variantes de campo de nome (`full_name`, `nome`, `name`), mas formularios do Facebook podem usar muitos outros nomes de campo, incluindo:

- `first_name` + `last_name` (campos separados)
- `nome_completo`
- `primeiro_nome` + `sobrenome`  
- Campos com espaco como `full name`
- Variantes em portugues como `nome completo`

### Solucao

Modificar o arquivo `supabase/functions/meta-webhook/index.ts` para:

1. **Expandir a lista de campos de nome** - Adicionar todas as variantes conhecidas
2. **Combinar first_name + last_name** - Quando o formulario usa campos separados
3. **Adicionar log dos campos recebidos** - Para facilitar debug futuro quando nomes nao forem encontrados
4. **Corrigir leads existentes** - Fornecer query SQL para atualizar leads que ja chegaram sem nome

### Arquivo a Modificar

**`supabase/functions/meta-webhook/index.ts`** - Linha 92

Substituir a logica simples atual:

```typescript
const name = fields["full_name"] || fields["nome"] || fields["name"] || "Lead do Facebook";
```

Por uma funcao robusta de extracao de nome:

```typescript
function extractLeadName(fields: Record<string, string>): string {
  // Tentar campo unico com nome completo
  const fullNameKeys = [
    "full_name", "full name", "fullname",
    "nome_completo", "nome completo", "nomecompleto",
    "nome", "name",
  ];
  
  for (const key of fullNameKeys) {
    if (fields[key]?.trim()) return fields[key].trim();
  }
  
  // Tentar combinar primeiro nome + sobrenome
  const firstName = fields["first_name"] || fields["primeiro_nome"] || fields["first name"] || "";
  const lastName = fields["last_name"] || fields["sobrenome"] || fields["last name"] || fields["ultimo_nome"] || "";
  
  if (firstName.trim()) {
    return lastName.trim() 
      ? `${firstName.trim()} ${lastName.trim()}` 
      : firstName.trim();
  }
  
  // Ultimo recurso: buscar qualquer campo que contenha "nome" ou "name" no nome do campo
  for (const [key, value] of Object.entries(fields)) {
    if ((key.includes("nome") || key.includes("name")) && value?.trim() && !key.includes("user")) {
      return value.trim();
    }
  }
  
  return "Lead do Facebook";
}
```

### Log para Debug

Adicionar log quando o nome nao for encontrado:

```typescript
const name = extractLeadName(fields);
if (name === "Lead do Facebook") {
  console.warn("Could not extract lead name. Fields received:", JSON.stringify(Object.keys(fields)));
}
```

### Atualizar EXCLUDED_FIELDS e BASIC_FIELDS

Adicionar as novas variantes na lista de campos basicos excluidos da qualificacao:

```typescript
const BASIC_FIELDS = new Set([
  "full_name", "full name", "fullname", "nome", "name",
  "nome_completo", "nome completo", "nomecompleto",
  "first_name", "primeiro_nome", "first name",
  "last_name", "sobrenome", "last name", "ultimo_nome",
  "phone_number", "telefone", "phone",
  "email", "e-mail"
]);
```

### Query para Corrigir Leads Existentes (opcional)

Apos o deploy, os leads que ja chegaram como "Lead do Facebook" nao serao corrigidos automaticamente (pois o dado original ja foi perdido). Mas novos leads virao com o nome correto.

### Resultado

- Todos os formularios do Facebook terao o nome extraido corretamente
- Campos separados (first_name + last_name) serao combinados
- Log de aviso quando nome nao for encontrado para facilitar debug
- Novos campos automaticamente detectados via busca por "nome"/"name"
