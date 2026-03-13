

## Redesign Completo: Layout Premium com Floating Sidebar + Bento Dashboard + Kanban Premium

Este e um redesign estrutural significativo. Vou dividir em partes claras.

### Escopo da Mudanca

**4 areas principais:**
1. Nova paleta de cores (CSS variables)
2. Floating Sidebar com animacao hover (substituir sidebar atual)
3. Top Bar minimalista
4. Dashboard Bento Grid com sparklines
5. Kanban Premium com efeitos hover/glow

### 1. Paleta de Cores — `src/index.css`

Atualizar as CSS variables do dark theme para os HEX exatos solicitados:

| Variavel | HEX alvo | HSL equivalente |
|----------|----------|-----------------|
| `--background` | #2b2d2c | 150 3% 17% |
| `--card` | #5a5f65 | 212 5% 37% (com glassmorphism via classe) |
| `--sidebar-background` | #465666 | 210 18% 34% |
| `--primary` | #81afd1 | 207 45% 66% |
| `--foreground` / texto | #ffffff e #a6c8e1 | branco + 208 47% 77% |

Adicionar tracking mais espacado para numeros via classe utilitaria `.tabular-nums`.

### 2. Floating Sidebar — Novo componente `FloatingSidebar.tsx`

Substituir o `AppSidebar` (sidebar larga de 256px) por uma barra flutuante:

- **Recolhida**: ~60px de largura, apenas icones, `position: fixed`, `left: 16px`, `top: 50%`, `transform: translateY(-50%)`, fundo `#465666`, `border-radius: 20px`
- **Hover**: expande para ~200px com Framer Motion (`animate={{ width }}`) mostrando rotulos
- Itens: Dashboard, Leads, Imoveis, Agenda, AI Insights (Conversas), Configuracoes
- Manter `BottomNav` para mobile (sem floating sidebar no mobile)

**Remover**: `SidebarProvider`, `SidebarTrigger`, `AppSidebar` do Layout. O Layout passa a usar apenas o `FloatingSidebar` no desktop.

### 3. Top Bar — Modificar `Layout.tsx`

Simplificar o header:
- Esquerda: "Ola, [Nome]" em branco (sem company name)
- Centro: Barra de busca global com icone + placeholder "Buscar..." + badge `⌘K`
- Direita: Sino de notificacao com indicador `#81afd1` + `animate-ping`
- Remover: toggle de tema, botao de menu mobile (sidebar trigger), info da empresa

### 4. Dashboard Bento Grid — Reescrever `Dashboard.tsx`

Layout CSS Grid assimetrico:

```text
┌──────────┬──────────┬──────────┬──────────┐
│ Leads    │ Leads    │ Follow-  │ VGV em   │
│ Hoje     │ Quentes  │ ups      │ Negoc.   │
├──────────┴──────────┼──────────┴──────────┤
│                     │                     │
│  AI Insights &      │  Funil de           │
│  Recomendacoes      │  Conversao          │
│  (painel grande)    │  (Recharts barras)  │
│                     │                     │
├─────────────────────┴─────────────────────┤
│  Leads Prioritarios (3 leads com avatar   │
│  + botoes WhatsApp/Telefone com glow)     │
└───────────────────────────────────────────┘
```

- Cards de metrica: fundo `#5a5f65` glassmorphism, numero grande branco, sparkline `#81afd1`
- AI Insights: icone Sparkles, 3 linhas de recomendacao
- Funil: barras horizontais com tons de azul
- Leads prioritarios: avatar iniciais, nome, botoes com hover glow

### 5. Kanban Premium — Modificar rendering no `Leads.tsx`

Quando em modo Kanban:
- Fundo `#2b2d2c` (ja e o background)
- Colunas sem fundo solido, apenas header sutil
- Cards: fundo escuro `#5a5f65/80` + `border border-white/10` + `backdrop-blur`
- Hover: `scale(1.02)`, `translateY(-5px)`, `box-shadow: 0 0 20px #81afd180`
- Framer Motion `whileHover` nos cards

### Dependencia nova

- `framer-motion` — necessario instalar para animacoes da sidebar e kanban cards

### Arquivos a criar/modificar

| Arquivo | Acao |
|---------|------|
| `src/index.css` | Atualizar CSS variables com nova paleta |
| `src/components/FloatingSidebar.tsx` | Criar — sidebar flutuante com Framer Motion |
| `src/components/Layout.tsx` | Refatorar — remover AppSidebar, usar FloatingSidebar, simplificar header |
| `src/pages/Dashboard.tsx` | Reescrever — Bento Grid com sparklines e glassmorphism |
| `src/components/LeadKanbanCard.tsx` | Atualizar — efeito hover glow com Framer Motion |
| `src/pages/Leads.tsx` | Atualizar — colunas kanban sem fundo solido, header sutil |
| `tailwind.config.ts` | Adicionar utilitarios de tracking para numeros |
| `package.json` | Adicionar `framer-motion` |

### O que NAO muda nesta fase

- Logica de dados (queries Supabase, hooks)
- Mobile BottomNav (mantido)
- Paginas secundarias (Settings, Calendar, etc) — layout novo se aplica via Layout.tsx
- Autenticacao e permissoes

