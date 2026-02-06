

# Redesign Completo da Tela de Leads

## Problemas Atuais Identificados

1. **Visual datado**: Cards sem personalidade, layout genérico
2. **Borda lateral grossa**: Igual aos outros cards (já mencionado pelo usuário)
3. **Header poluído**: Muitos elementos competindo por atenção
4. **Mini-stats simples**: Apenas badges em linha sem contexto visual
5. **Kanban denso**: Cards muito carregados de informação
6. **Falta de hierarquia visual**: Não fica claro o que é mais importante
7. **Experiência móvel básica**: Accordion sem visual diferenciado

---

## Proposta: Nova Experiência de Leads

### Conceito: "Command Center"
Uma interface focada em ação, onde o corretor vê rapidamente o que importa e age em segundos.

```text
┌─────────────────────────────────────────────────────────────────┐
│  HERO STATS (visual rico com cards de temperatura)              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│
│  │🔥 Quentes│ │☀️ Mornos │ │❄️ Frios  │ │👤 Sem    │ │📊 Total ││
│  │    12    │ │    28    │ │    45    │ │  Corretor│ │   85    ││
│  │  +3 hoje │ │  +5 hoje │ │  +2 hoje │ │    8     │ │ +10 hoje││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘│
├─────────────────────────────────────────────────────────────────┤
│  SEARCH + VIEW TOGGLE + ACTIONS                                 │
│  [🔍 Buscar...]  [Filtros v]  [Kanban|Database]  [+ Novo]  [⚙️] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  KANBAN MODERNO (cards limpos, sem borda lateral)               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ ● Novo Lead  │ │ ● Contatado  │ │ ● Visitou    │             │
│  │     12       │ │      8       │ │      5       │             │
│  ├──────────────┤ ├──────────────┤ ├──────────────┤             │
│  │ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │             │
│  │ │ Avatar+Nm│ │ │ │ Avatar+Nm│ │ │ │ Avatar+Nm│ │             │
│  │ │ 🔥 2h ago│ │ │ │ ☀️ 1d ago│ │ │ │ ❄️ 3d ago│ │             │
│  │ │ [WhatsApp]│ │ │ [WhatsApp]│ │ │ [WhatsApp]│ │              │
│  │ └──────────┘ │ │ └──────────┘ │ │ └──────────┘ │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Hero Stats Redesenhado

### De badges simples para cards visuais

**Novo Componente: `LeadsHeroStats.tsx`**

```typescript
// Cards visuais com gradientes e indicadores de tendência
interface StatCard {
  icon: LucideIcon;
  label: string;
  value: number;
  trend?: number; // +3 hoje
  color: string;  // gradiente personalizado
  onClick?: () => void; // filtrar por categoria
}
```

**Visual:**
- Cards com gradiente sutil de fundo
- Ícone grande e valor em destaque
- Indicador de tendência ("+3 hoje")
- Clicável para filtrar leads por categoria
- Animação sutil no hover

---

## 2. Cards de Lead Redesenhados

### Removendo borda lateral, adicionando modernidade

**Mudanças no `LeadKanbanCard.tsx`:**

| Antes | Depois |
|-------|--------|
| `border-l-4` com cor de temperatura | Sem borda lateral |
| Background sólido | Gradiente sutil baseado em temperatura |
| Avatar pequeno | Avatar com anel de cor |
| Informações densas | Layout limpo e hierárquico |
| Menu sempre visível | Menu no hover |

**Novo Visual:**
```text
┌─────────────────────────────┐
│ [Avatar]  João Silva    ⋮   │
│           🔥 há 2h          │
│ ─────────────────────────── │
│ 📞 (11) 99999-9999          │
│ 🏠 Apartamento Centro       │
│ ─────────────────────────── │
│ [    💬 WhatsApp     ]      │
└─────────────────────────────┘
```

**Indicadores visuais de temperatura:**
- **Hot**: Anel laranja no avatar + gradiente sutil laranja
- **Warm**: Anel amarelo no avatar + gradiente sutil amarelo
- **Cold**: Anel azul no avatar + gradiente sutil azul

---

## 3. Kanban Moderno

### Colunas com glassmorphism e visual limpo

**Mudanças:**
- Remover background cinza do container
- Colunas com efeito glassmorphism sutil
- Headers mais compactos e elegantes
- Contagem com badge estilizado
- Área de drop com indicador visual moderno

**Novo Layout de Coluna:**
```text
┌─────────────────────────────┐
│ ● Novo Lead           12    │  <- Header compacto
├─────────────────────────────┤
│                             │
│  [Card 1]                   │
│  [Card 2]                   │
│  [Card 3]                   │
│                             │
│  (arraste aqui)             │  <- Drop zone elegante
│                             │
└─────────────────────────────┘
```

---

## 4. Database View Aprimorado

### Tabela moderna com ações rápidas

**Mudanças no `LeadsDatabaseView.tsx`:**
- Remover Card wrapper (visual mais limpo)
- Tabela com rows clicáveis e hover elegante
- Avatar inline no nome
- Ações em hover row (não dropdown)
- Paginação moderna com info contextual

---

## 5. Mobile Experience Revolucionário

### Cards expansíveis com swipe actions

**Novo comportamento:**
- Swipe direita: Abrir WhatsApp
- Swipe esquerda: Menu de ações
- Tap: Expandir detalhes inline
- Long press: Selecionar para ações em massa

**FAB (Floating Action Button):**
- Botão flutuante "+ Novo Lead" no canto inferior direito
- Sempre visível durante scroll

---

## 6. Quick Actions Bar

### Barra de ações contextuais quando há seleção

```text
┌─────────────────────────────────────────────────────────────────┐
│ 3 selecionados  [Alterar Status v] [Atribuir v] [Deletar] [✕]  │
└─────────────────────────────────────────────────────────────────┘
```

Aparece como uma barra fixa no topo quando leads são selecionados.

---

## Arquivos a Criar/Modificar

### Novos Componentes

| Arquivo | Descrição |
|---------|-----------|
| `src/components/leads/LeadsHeroStats.tsx` | Cards visuais de estatísticas |
| `src/components/leads/LeadCard.tsx` | Novo card de lead moderno |
| `src/components/leads/LeadsKanbanColumn.tsx` | Coluna de kanban modular |
| `src/components/leads/LeadsQuickBar.tsx` | Barra de ações rápidas |
| `src/components/leads/LeadsMobileFAB.tsx` | Botão flutuante mobile |

### Modificações

| Arquivo | Mudanças |
|---------|----------|
| `src/pages/Leads.tsx` | Novo layout com Hero Stats, refatorar estrutura |
| `src/components/LeadKanbanCard.tsx` | Remover borda, novo visual |
| `src/components/leads/LeadsMiniStats.tsx` | Substituir por LeadsHeroStats |
| `src/components/leads/LeadMobileCard.tsx` | Novo visual com swipe |
| `src/components/leads/LeadsDatabaseView.tsx` | Visual mais limpo |
| `src/components/leads/LeadsTable.tsx` | Rows modernas com hover actions |

---

## Design System Aplicado

### Paleta de Cores (mantida)
- Primary: #81afd1 (azul claro)
- Background: #2b2d2c (escuro)
- Cards: #465666 (azul-cinza)

### Novos Tokens de Temperatura
```css
--temperature-hot: linear-gradient(135deg, rgba(249,115,22,0.1) 0%, transparent 100%);
--temperature-warm: linear-gradient(135deg, rgba(234,179,8,0.1) 0%, transparent 100%);
--temperature-cold: linear-gradient(135deg, rgba(96,165,250,0.1) 0%, transparent 100%);
```

### Efeitos
- Glassmorphism nas colunas: `backdrop-blur-sm bg-background/80`
- Hover suave: `transition-all duration-200`
- Sombra elegante: `shadow-lg shadow-primary/5`

---

## Fases de Implementação

### Fase 1: Foundation (Cards e Stats)
1. Criar `LeadsHeroStats.tsx` com cards visuais
2. Refatorar `LeadKanbanCard.tsx` (remover borda, novo visual)
3. Atualizar `LeadMobileCard.tsx`

### Fase 2: Kanban Moderno
1. Criar `LeadsKanbanColumn.tsx` modular
2. Aplicar glassmorphism nas colunas
3. Melhorar indicadores de drag-and-drop

### Fase 3: Page Layout
1. Refatorar `Leads.tsx` com novo header
2. Integrar `LeadsHeroStats`
3. Limpar estrutura e remover código duplicado

### Fase 4: Database View
1. Modernizar `LeadsDatabaseView.tsx`
2. Melhorar `LeadsTable.tsx` com hover actions
3. Adicionar avatar inline

### Fase 5: Mobile
1. Adicionar FAB para novo lead
2. Implementar swipe actions (opcional)
3. Melhorar accordion visual

---

## Resultado Esperado

- **Visual Moderno**: Interface limpa e profissional
- **Hierarquia Clara**: O mais importante em destaque
- **Ação Rápida**: WhatsApp em 1 clique, status em 2
- **Sem Bordas Grossas**: Visual clean seguindo a preferência do usuário
- **Mobile First**: Experiência otimizada para corretores em campo
- **Consistência**: Mesmo design system do dashboard renovado

