

## Redesign Kanban Cards + Colunas — "Minimalist Corporate Luxury"

### 1. LeadKanbanCard.tsx — Rewrite completo

**Container:**
- `bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-5` (glass fosco)
- Manter Framer Motion hover (scale 1.02, y -5) e glow shadow

**Header (top):**
- Avatar (iniciais) + Nome (`text-white font-semibold text-sm truncate`) alinhados a esquerda
- Badge de tempo no canto superior direito: `bg-white/5 text-gray-400 text-xs rounded-full px-2 py-0.5`
- TemperatureBadge pequeno ao lado do nome
- Dropdown menu (3 dots) aparece no hover do card (manter comportamento atual)

**Body (contatos):**
- Remover icones Phone/Mail — apenas texto
- Telefone e email em `text-gray-400 text-xs`, um embaixo do outro, spacing sutil
- Tags row (origem, duplicado, imovel) mantidas mas discretas

**Footer (acoes):**
- Separador: `border-t border-white/5 mt-3 pt-3`
- Flex row com icon buttons: WhatsApp, Phone, Mail alinhados a esquerda
- Icones em `text-gray-500 h-4 w-4`
- WhatsApp hover: `hover:text-[#81afd1]` com `motion whileHover={{ scale: 1.15 }}`
- Phone e Mail hover: `hover:text-white`
- Remover WhatsAppButton component largo — usar link direto `wa.me`
- Warning de whatsapp error mantido como tooltip no icone

### 2. Leads.tsx — Colunas Kanban

**Gap entre colunas:** `gap-4` → `gap-6`

**Titulo da coluna:** `font-semibold text-sm` → `text-gray-300 font-medium text-sm`

### Arquivos a modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/LeadKanbanCard.tsx` | Rewrite visual completo — glass container, footer com icon buttons, remover WhatsAppButton largo |
| `src/pages/Leads.tsx` | gap-6 nas colunas, titulo text-gray-300 font-medium |

