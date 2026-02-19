
## Ajuste Visual das Variáveis de Formulário Meta no Modal de Templates

### Problema

As variáveis de formulário Meta (ex: `{form_qual_valor_você_considera_investir_no_imóvel?}`) são muito longas para caber em um grid de 2 colunas ou numa linha de `flex-wrap`. O resultado é o que aparece no print: badges sobrepostos, cortados e ilegíveis.

### Solução

Dois locais no arquivo `src/components/whatsapp/WhatsAppTemplatesModal.tsx` precisam ser ajustados:

**1. List View — seção "Variáveis Disponíveis" (linhas 448-459)**

Trocar `grid grid-cols-2` (que quebra com nomes longos) por `grid grid-cols-1`, onde cada variável Meta ocupa uma linha inteira. O Badge com o código fica à esquerda e o label à direita, com `truncate` no label para não exceder o espaço:

```
Antes: grid grid-cols-2 → dois por linha → overflow e sobreposição
Depois: grid grid-cols-1 → um por linha → limpo e legível
```

**2. Form View — editor de template (linhas 324-337)**

No painel de inserção de variáveis do editor, os badges de formulário ficam em `flex flex-wrap gap-2`, o que também causa sobreposição. Trocar para uma lista vertical (`flex flex-col gap-1`) com cada item mostrando o código e o label lado a lado.

### Resultado Visual Esperado

```
Mostrar mais variáveis (4 de formulário Meta)  ▼
┌─────────────────────────────────────────────────────┐
│ {form_qual_valor_você...}   Qual valor considera... │
│ {form_para_entendermos...}  Para entendermos...     │
│ {form_qual_seu_momento...}  Qual seu momento...     │
│ {form_qual_o_valor_max...}  Qual o valor máximo...  │
└─────────────────────────────────────────────────────┘
```

### Arquivo Modificado

**`src/components/whatsapp/WhatsAppTemplatesModal.tsx`** — dois blocos:

1. **Linhas 448-459** (list view, variáveis expandidas): trocar `grid grid-cols-2 gap-x-4 gap-y-1` por `flex flex-col gap-1.5` e deixar o Badge com `max-w-full` e `truncate` para não vazar.

2. **Linhas 324-337** (form view, editor): trocar `flex flex-wrap gap-2` por `flex flex-col gap-1.5`, exibindo cada variável de formulário como uma linha com badge + label.
