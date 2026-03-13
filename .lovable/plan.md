

## Refatoração: Tela de Imóveis — Visual "Portfólio de Luxo / Home Broker"

### Componentes afetados

1. **`src/components/properties/PropertyMetricsCard.tsx`** — reescrever completamente
2. **`src/components/properties/PropertiesKPIs.tsx`** — converter em barra contínua
3. **`src/pages/Properties.tsx`** — ajustar barra de filtros e grid

---

### 1. PropertyMetricsCard — Card Premium com Thumbnail

**Estrutura do novo card:**

```text
┌──────────────────────────────────┐
│  ┌────────────────────────────┐  │
│  │   THUMBNAIL / PLACEHOLDER  │  │  ← gradient bg + ícone de arquitetura
│  │                            │  │  ← hover: scale-105 interno
│  │            [Disponível]    │  │  ← badge neon flutuante canto sup. dir.
│  └────────────────────────────┘  │
│                                  │
│  Ap Jd Barão                     │  ← text-white font-bold
│  R$ 350.000                      │  ← text-[#81afd1] font-bold text-lg
│  📍 Centro, Campinas            │  ← MapPin + text-white/50 text-xs
│                                  │
│  [🛏 3] [🚿 2] [🚗 1] [85m²]   │  ← pills bg-white/5 rounded-md
│                                  │
│  ─────────────────────────────── │  ← border-t border-white/5
│  👥 11  🔥 0  💰 CPL R$ 0      │  ← rodapé compacto inline
│  [👁 Detalhes] [✏] [🗑]        │  ← ações
└──────────────────────────────────┘
```

**Detalhes técnicos:**

- **Container**: `bg-[#5a5f65]/30 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden`
- **Hover**: `hover:border-[#81afd1]/40 hover:shadow-[0_0_20px_rgba(129,175,209,0.15)]` + thumbnail `group-hover:scale-105 transition-transform duration-500`
- **Thumbnail**: `div` com `h-40 overflow-hidden` contendo um inner div com `bg-gradient-to-br from-[#2b2d2c] to-[#81afd1]/20` e ícone `Building2` centralizado (h-12 w-12 text-white/10)
- **Status badge neon**: Posição `absolute top-3 right-3` sobre a imagem. Disponível: `bg-emerald-500/10 border border-emerald-400/40 text-emerald-400`. Reservado: `bg-yellow-500/10 border border-yellow-400/40 text-yellow-400`. Etc.
- **Preço**: Logo abaixo do título, `text-[#81afd1] font-bold text-lg tabular-nums`
- **Localização**: `MapPin` h-3 w-3 + texto `text-white/50 text-xs`
- **Specs pills**: `flex flex-wrap gap-1.5`, cada pill: `bg-white/5 px-2 py-1 rounded-md text-xs text-white/60 flex items-center gap-1`
- **Rodapé métricas**: Uma única linha `flex items-center gap-4 text-xs text-white/40` separada por `border-t border-white/5 pt-3`. Formato: `👥 11 | 🔥 0 | CPL R$ 0`
- **Remover**: O bloco grid 4-cols de métricas pesado e o sparkline
- **Ações**: Manter no final, mesma linha, mas simplificado

---

### 2. PropertiesKPIs — Barra Contínua (Bento Header)

**Mudança**: Trocar o grid de 6 `MiniMetricCard` separados por uma **barra contínua única** com divisórias internas.

- Container: `flex items-center bg-[#5a5f65]/30 backdrop-blur-sm border border-white/10 rounded-xl p-0 divide-x divide-white/10`
- Cada métrica: `flex-1 flex items-center gap-2 px-4 py-3` (inline, compacto)
- Ícone menor (h-4 w-4) + valor em `font-bold text-sm` + título em `text-[10px] text-white/40`
- Reduz altura vertical significativamente vs 6 cards separados

---

### 3. Barra de Filtros — Linha Elegante

**Mudança** em `Properties.tsx` (linhas 598-633):

- Envolver busca + selects em um container com `bg-[#5a5f65]/20 backdrop-blur-sm border border-white/10 rounded-xl p-2 flex items-center gap-2`
- Input de busca e selects com `bg-[#2b2d2c]/50 border-white/10` — tudo numa única linha alinhada
- Manter a mesma lógica funcional

---

### O que NÃO muda
- Toda a lógica de state, fetch, CRUD em `Properties.tsx`
- O Dialog de criação/edição de imóvel
- Os modais `PropertyDetailModal` e `LeadDetailModal`
- O componente `PropertiesKPIs` continua buscando os mesmos dados — só muda o visual

