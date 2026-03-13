

## Refinamento Visual: "Minimalist Corporate Luxury"

Ajustes cirurgicos em 4 arquivos para corrigir cores, contrastes e efeitos glass.

### 1. Floating Sidebar (`FloatingSidebar.tsx`)

- Trocar `bg-secondary` por `bg-[#465666]` no `motion.nav`
- Menu items inativos: `text-white/70 hover:bg-white/10 hover:text-white`
- Menu items ativos: `bg-white/10 text-white`
- "Agencia" (Shield): trocar `text-warning` por `text-[#81afd1]` e hover `bg-[#81afd1]/10`

### 2. LeadsHeroStats (`leads/LeadsHeroStats.tsx`)

- Remover gradients coloridos (`from-orange-500/20`, `from-yellow-500/20`, `from-blue-400/20`) dos cards
- Todos os cards: fundo uniforme `glass` (bg escuro com backdrop-blur + border-white/10)
- Manter cores de status apenas nos icones e nos numeros/textos pequenos (iconColor permanece)
- Remover o glow blur circle colorido de fundo

### 3. Kanban Columns (`Leads.tsx` ~line 1257)

- Coluna container: trocar `border border-border/20` por `bg-transparent border-0` (sem fundo, sem borda)
- Manter apenas o header da coluna com separador sutil
- Cards ja estao com glass no `LeadKanbanCard.tsx` — apenas confirmar `border border-white/10`

### 4. Dashboard Panels (`Dashboard.tsx`)

- Paineis "AI Insights" e "Leads Prioritarios": adicionar `border border-white/10 backdrop-blur-md` (ja usam `.glass` mas confirmar que a classe inclui border)
- Verificar que `.glass` em `index.css` ja tem `border: 1px solid hsl(var(--glass-border))` — esta ok
- Adicionar `border border-white/5` explicito nos paineis como reforco visual

### Arquivos a modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/FloatingSidebar.tsx` | bg-[#465666], text-white, hover:bg-white/10, Agencia em #81afd1 |
| `src/components/leads/LeadsHeroStats.tsx` | Remover gradients coloridos, fundo glass uniforme, cores so nos icones |
| `src/pages/Leads.tsx` | Kanban columns bg-transparent, sem border |
| `src/pages/Dashboard.tsx` | Adicionar border-white/5 nos paineis glass |

