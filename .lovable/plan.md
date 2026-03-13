

## Refatoração: Kanban de Leads — Estética Premium Glassmorphism

### Análise

Ao examinar o código, os badges de **TemperatureBadge** e **OriginBadge** já usam o estilo neon (bg transparente + border colorida + texto vibrante) — portanto não precisam de alteração. O foco é no **LeadKanbanCard.tsx** e nas **colunas do Kanban** em `Leads.tsx`.

### Mudanças

#### 1. `src/components/LeadKanbanCard.tsx` — Redesign completo do card

**Container:**
- Trocar `bg-black/20` por `bg-[#5a5f65]/30 backdrop-blur-md border-white/10`
- Hover: `hover:border-[#81afd1]/50 hover:-translate-y-1` (substituir o scale atual)
- Manter `rounded-xl`, drag state com `ring-2 ring-[#81afd1]/40`

**Header (Avatar + Nome + Tempo):**
- Substituir `AvatarFallbackColored` (gradientes coloridos) por avatar com fundo escuro uniforme `bg-[#465666] text-[#a6c8e1]`
- Nome: manter `text-white font-semibold text-sm`, aumentar `max-w` do truncate
- Time badge: `bg-white/5 border border-white/10 text-gray-400 text-[11px] rounded-full`

**Corpo — Reorganizar layout:**
- Mover telefone e email para o rodapé
- Tags (origem, temperatura, duplicado) ficam logo abaixo do nome
- Imóvel de interesse: criar mini-container `bg-black/20 p-2 rounded-md` com ícone `Building2` + texto `text-[#a6c8e1] text-xs`

**Rodapé — Separação clara:**
- Linha `border-t border-white/5 mt-3 pt-3`
- Lado esquerdo: telefone e email empilhados `text-gray-400 text-xs font-mono`
- Lado direito: ícones de ação (WhatsApp, Phone, Email) que ficam `text-gray-500` e ganham `hover:text-[#81afd1] hover:scale-110`

#### 2. `src/components/ui/avatar-fallback-colored.tsx` — Adicionar variante "dark"

Adicionar uma prop `variant?: "gradient" | "dark"` para que o Kanban use a versão escura (`bg-[#465666] text-[#a6c8e1]`) enquanto outros lugares mantêm o gradiente.

#### 3. `src/pages/Leads.tsx` (linhas 1256-1284) — Colunas do Kanban

- Column container: já usa `bg-transparent` — manter
- Column header: trocar `border-border/50` por `border-white/10`
- Titulo: `text-white font-medium text-sm` (trocar de `text-gray-300`)
- Badge contador: trocar `Badge variant="secondary"` por badge translúcida `bg-white/10 text-white rounded-full px-2 py-0.5 text-xs font-bold` (remover cor inline do status)
- Manter bolinha colorida com glow como está

### O que NÃO muda
- TemperatureBadge e OriginBadge (já estão no estilo neon correto)
- Lógica de drag-and-drop, portals, filtros
- WhatsAppChatModal
- Dropdown menu de ações (Ver, Editar, Deletar)

