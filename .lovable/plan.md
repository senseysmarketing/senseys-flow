
## Plano de Correcao da Tela de Leads no Mobile

### Problema Identificado

Analisando a screenshot e o codigo, o problema esta na estrutura de altura e overflow da pagina de Leads no mobile. Os cards de leads dentro do accordion nao estao acessiveis/scrollaveis porque:

1. O container principal usa altura fixa com `calc(100vh-8rem)` que pode nao deixar espaco suficiente
2. O container de conteudo usa `overflow-hidden` que bloqueia o scroll do accordion interno
3. O padding inferior (`pb-20`) pode nao ser suficiente para compensar o BottomNav

### Estrutura Atual vs Proposta

```text
ATUAL:
+------------------------------------------+
| Header (h-14/56px)                       |
+------------------------------------------+
| HeroStats (grid 2 colunas) - ~200px      |
+------------------------------------------+
| Titulo "Leads" + Botoes                  |
+------------------------------------------+
| Search + Filtros                         |
+------------------------------------------+
| Toggle Kanban/Lista                      |
+------------------------------------------+
| Accordion (overflow-y-auto) [CORTADO]    |  <- altura restante insuficiente
+------------------------------------------+
| BottomNav (h-16/64px)                    |
+------------------------------------------+

PROPOSTA:
+------------------------------------------+
| Header (h-14)                            |
+------------------------------------------+
| Conteudo scrollavel completo             |
|   - HeroStats                            |
|   - Titulo + Botoes                      |
|   - Search + Filtros + Toggle            |
|   - Accordion com leads                  |
|   - Espaco extra para BottomNav          |
+------------------------------------------+
| BottomNav (h-16)                         |
+------------------------------------------+
```

### Solucao Tecnica

A solucao envolve ajustar a estrutura de scroll na pagina de Leads para mobile, permitindo que todo o conteudo (incluindo stats, filtros e accordion) seja scrollavel verticalmente.

#### Arquivo: `src/pages/Leads.tsx`

**Mudanca 1**: Ajustar o container principal (linha 699)
- Remover `overflow-hidden` do container principal
- Usar uma abordagem de flex que permita scroll natural no mobile

**Mudanca 2**: Ajustar o container de conteudo scrollavel (linha 992)
- No mobile, todo o conteudo deve ser scrollavel junto
- O accordion nao precisa de container separado com scroll

**Mudanca 3**: Garantir espaco adequado para BottomNav
- Aumentar padding inferior para `pb-24` (96px) para garantir que o ultimo item do accordion seja visivel

### Mudancas Especificas

**Linhas 699-701** - Container principal:
```typescript
// DE:
<div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)] overflow-hidden">
  {/* Fixed Header - Does NOT scroll */}
  <div className="shrink-0 space-y-4 pb-4 w-full max-w-full min-w-0 overflow-hidden">

// PARA:
<div className={cn(
  "flex flex-col",
  isMobile ? "min-h-0" : "h-[calc(100vh-6rem)] overflow-hidden"
)}>
  {/* Header area */}
  <div className={cn(
    "space-y-4 pb-4 w-full max-w-full min-w-0",
    !isMobile && "shrink-0 overflow-hidden"
  )}>
```

**Linhas 992-1048** - Container de conteudo scrollavel para mobile:
```typescript
// DE:
<div className="flex-1 min-h-0 overflow-hidden">
  {viewMode === 'kanban' ? (
    isMobile ? (
      // Mobile: Kanban as Accordion with its own scroll
      <div className="h-full overflow-y-auto space-y-2 pb-20">

// PARA:
<div className={cn(
  "flex-1 min-h-0",
  !isMobile && "overflow-hidden"
)}>
  {viewMode === 'kanban' ? (
    isMobile ? (
      // Mobile: Kanban as Accordion - no extra scroll container needed
      <div className="space-y-2 pb-24">
```

### Abordagem Alternativa (se a primeira nao funcionar)

Se a primeira abordagem ainda apresentar problemas, uma alternativa mais robusta seria:

1. No mobile, nao usar altura fixa calculada
2. Deixar o Layout.tsx controlar todo o scroll (ja tem `overflow-y-auto` no main)
3. Remover containers de scroll internos no mobile

### Arquivos a Modificar

| Arquivo | Tipo de Mudanca |
|---------|-----------------|
| `src/pages/Leads.tsx` | Ajustar containers de altura e overflow para mobile |

### Impacto

- **Risco**: Baixo - mudancas isoladas a condicoes mobile
- **Tempo estimado**: 10 minutos
- **Beneficio**: Usuarios mobile poderao navegar por todas as colunas e cards de leads
