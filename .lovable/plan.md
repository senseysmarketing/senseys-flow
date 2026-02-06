
## Correção Definitiva do Scroll Horizontal na Página de Leads

### Diagnóstico do Problema

Analisando o screenshot enviado e a estrutura do código:

1. O card "Total" do `LeadsHeroStats` está cortado à esquerda
2. Os cards de stats (Quentes, Mornos, Frios) estão sendo afetados pelo scroll horizontal
3. O problema persiste mesmo após adicionar `overflow-x-hidden` nos containers

**Causa raiz identificada**: O `LeadsHeroStats` usa um grid de 5 colunas (`lg:grid-cols-5`) que força uma largura mínima. Quando combinado com o container das colunas do Kanban (que tem scroll horizontal), o scroll está "propagando" para cima e afetando todo o container da página.

### Solução Proposta

Precisamos criar uma **isolação completa** entre o header fixo e a área de scroll, usando uma estrutura de layout mais robusta.

### Mudanças Técnicas

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Leads.tsx` | Reestruturar layout com isolação absoluta entre header e área de scroll |
| `src/components/leads/LeadsHeroStats.tsx` | Garantir que o grid não force largura maior que o container |

### Estrutura de Layout Corrigida

```text
┌─────────────────────────────────────────────────────────────────┐
│ Container Principal (h-full, flex flex-col, overflow-hidden)   │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ HEADER FIXO (shrink-0, overflow-hidden)                     │ │
│ │ position: relative, width: 100%, max-width: 100%            │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ LeadsHeroStats (grid com min-w-0 para evitar overflow)  │ │ │
│ │ │ Busca + Filtros + Controles                              │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ÁREA DE CONTEÚDO (flex-1, min-h-0, overflow-hidden)         │ │
│ │ Contexto de scroll ISOLADO do header                        │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ Kanban Container (h-full, overflow-hidden)               │ │ │
│ │ │ ┌─────────────────────────────────────────────────────┐ │ │ │
│ │ │ │ Colunas (overflow-x-auto) ←─ scroll horizontal aqui│ │ │ │
│ │ │ │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                  │ │ │ │
│ │ │ │ │Col1│ │Col2│ │Col3│ │Col4│ │Col5│                  │ │ │ │
│ │ │ │ └────┘ └────┘ └────┘ └────┘ └────┘                  │ │ │ │
│ │ │ └─────────────────────────────────────────────────────┘ │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Mudanças Específicas

**1. `src/pages/Leads.tsx` - Linha 699:**
```tsx
// Antes
<div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)] overflow-x-hidden">

// Depois - adicionar overflow-hidden (não apenas overflow-x-hidden)
<div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)] overflow-hidden">
```

**2. `src/pages/Leads.tsx` - Linha 701 (Header):**
```tsx
// Antes
<div className="shrink-0 space-y-4 pb-4 w-full max-w-full overflow-x-hidden">

// Depois - usar min-w-0 para permitir que filhos encolham
<div className="shrink-0 space-y-4 pb-4 w-full max-w-full min-w-0 overflow-hidden">
```

**3. `src/components/leads/LeadsHeroStats.tsx` - Linha 111:**
```tsx
// Antes
<div className={cn("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3", className)}>

// Depois - adicionar min-w-0 e overflow-hidden para conter o grid
<div className={cn("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 min-w-0 w-full", className)}>
```

**4. Também precisamos garantir que cada card de stat não force expansão:**
```tsx
// Em cada button/card do LeadsHeroStats, adicionar min-w-0:
<button
  className={cn(
    "relative overflow-hidden rounded-xl p-4 text-left transition-all duration-300 min-w-0",
    // ... resto das classes
  )}
>
```

### Por que `min-w-0` é essencial

Em flexbox e grid, os elementos filhos têm um `min-width: auto` por padrão, o que significa que eles não podem encolher abaixo do seu conteúdo. Adicionando `min-w-0`, permitimos que os elementos encolham para caber no container pai, evitando que forcem scroll horizontal.

### Resultado Esperado

- Header com Hero Stats e controles **sempre fixo e totalmente visível**
- Cards de stats se adaptam à largura disponível sem forçar scroll
- Scroll horizontal **restrito apenas às colunas do Kanban**
- Nenhum elemento do header se move ou é cortado ao scrollar as colunas
