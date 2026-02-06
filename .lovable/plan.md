

## Correção do Scroll Horizontal na Página de Leads

### Problema Identificado

Analisando o código e o screenshot, o problema é:

1. O container principal da página (`div.flex.flex-col`) não tem `overflow-x: hidden`
2. O header (Hero Stats + controles) está no mesmo contexto de layout que as colunas
3. Quando o scroll horizontal é ativado nas colunas, ele "vaza" para o container pai
4. Isso faz com que todo o conteúdo, incluindo o header, se mova horizontalmente

### Solução

Adicionar `overflow-x-hidden` no container principal da página e garantir que **apenas** o container interno das colunas tenha `overflow-x-auto`.

### Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Leads.tsx` | Adicionar `overflow-x-hidden` no wrapper principal e no header fixo |

### Mudanças Específicas

**Linha 699 - Container principal da página:**
```tsx
// Antes
<div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)]">

// Depois  
<div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)] overflow-x-hidden">
```

**Linha 701 - Header fixo (adicionar constraint de largura):**
```tsx
// Antes
<div className="shrink-0 space-y-4 pb-4">

// Depois
<div className="shrink-0 space-y-4 pb-4 w-full max-w-full overflow-x-hidden">
```

### Por que isso funciona

1. `overflow-x-hidden` no container principal impede que o scroll horizontal vaze para fora
2. `w-full max-w-full` no header garante que ele não ultrapasse a largura do viewport
3. `overflow-x-hidden` no header impede que conteúdo interno expanda além do limite
4. O `overflow-x-auto` continua apenas no container das colunas do Kanban

### Estrutura Visual do Layout

```text
┌─────────────────────────────────────────────────────────────────┐
│ Container Principal (overflow-x-hidden)                         │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ HEADER FIXO (shrink-0, w-full, max-w-full, overflow-x-hidden)│ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ Hero Stats + Controles + Busca + Filtros                │ │ │
│ │ │ (sempre visível, não scroll horizontal)                 │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ÁREA DE CONTEÚDO (flex-1, min-h-0, overflow-hidden)         │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ KANBAN COLUMNS (overflow-x-auto) ←──scroll horizontal──→│ │ │
│ │ │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐            │ │ │
│ │ │ │Col 1 │ │Col 2 │ │Col 3 │ │Col 4 │ │Col 5 │            │ │ │
│ │ │ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘            │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Resultado Esperado

- Header com Hero Stats e controles **sempre fixo e visível**
- Scroll horizontal **restrito apenas às colunas do Kanban**
- Nenhum elemento do header se move ou é cortado ao scrollar
- Comportamento consistente em todas as resoluções

