

## Ajuste do Scroll Horizontal na Página de Leads

### Problema Atual
O scroll horizontal está afetando toda a área da página, incluindo potencialmente o header com os controles. O usuário quer que apenas a área das colunas do Kanban tenha scroll horizontal, mantendo o menu superior sempre visível.

### Solução
Reestruturar o layout da página de Leads para separar claramente:
1. **Área fixa** (header): Hero Stats, busca, filtros, botões de toggle
2. **Área com scroll** (kanban): Apenas as colunas do Kanban terão scroll horizontal

### Mudanças Técnicas

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Leads.tsx` | Reorganizar layout com `flex flex-col h-full` e área fixa vs. scrollável |

### Estrutura do Layout

```text
┌─────────────────────────────────────────────────────────────────┐
│  HEADER FIXO (não scrollável)                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Hero Stats (Quentes | Mornos | Frios | Sem Corretor)      │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ [Busca] [Filtros] [Kanban|Lista] [+ Novo] [⚙️] [🔔]       │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  ÁREA SCROLLÁVEL (horizontal apenas nas colunas)                │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐       │
│  │  Novo    │ Contatado│ Visitou  │ Qualific.│ Negociação│ ←→   │
│  │  Lead    │          │          │          │           │       │
│  │  ┌────┐  │  ┌────┐  │  ┌────┐  │  ┌────┐  │  ┌────┐   │       │
│  │  │Card│  │  │Card│  │  │Card│  │  │Card│  │  │Card│   │       │
│  │  └────┘  │  └────┘  │  └────┘  │  └────┘  │  └────┘   │  ↕    │
│  │  ┌────┐  │  ┌────┐  │          │          │           │       │
│  │  │Card│  │  │Card│  │          │          │           │       │
│  │  └────┘  │  └────┘  │          │          │           │       │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### Código Atual vs. Proposto

**Atual (linhas 991-1055):**
```tsx
{/* Scrollable Content Area */}
<div className="flex-1 min-h-0">
  {viewMode === 'kanban' ? (
    // Desktop: Kanban View
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="h-full rounded-xl flex flex-col">
        {/* Kanban columns - horizontal scroll ONLY here */}
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden ...">
```

**Proposto:**
```tsx
{/* Scrollable Content Area - horizontal scroll CONTAINED */}
<div className="flex-1 min-h-0 overflow-hidden">
  {viewMode === 'kanban' ? (
    // Desktop: Kanban View
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="h-full flex flex-col overflow-hidden">
        {/* Kanban columns container with isolated horizontal scroll */}
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden custom-scrollbar">
```

### Mudanças Específicas

1. **Wrapper externo** (`flex-1 min-h-0`): Adicionar `overflow-hidden` para conter qualquer vazamento
2. **Container do Kanban**: Garantir `overflow-hidden` no wrapper
3. **Container das colunas**: Manter `overflow-x-auto` apenas no flex container interno que tem as colunas

### Classes CSS Críticas

```css
/* Área fixa do header */
.header-area {
  flex-shrink: 0; /* Não encolhe */
}

/* Área de scroll das colunas */
.kanban-scroll-area {
  flex: 1;
  min-height: 0; /* Permite encolher */
  overflow-x: auto;
  overflow-y: hidden;
}

/* Colunas individuais */
.kanban-column {
  flex-shrink: 0;
  width: 330px;
  overflow-y: auto; /* Scroll vertical dentro de cada coluna */
}
```

### Resultado Esperado
- Header com stats e controles sempre visível na parte superior
- Scroll horizontal restrito apenas às colunas do Kanban
- Cada coluna mantém seu próprio scroll vertical para os cards
- Comportamento consistente em diferentes tamanhos de tela

