

## Ajustes no Dashboard: 3 Correções

### 1. Funil de Conversão — Títulos em uma linha só

**Arquivo**: `src/pages/Dashboard.tsx` (linha 190-196)

O `YAxis` do Recharts tem `width={90}`, insuficiente para nomes longos como "Aguard. 1ª resp 3d". Aumentar para `width={120}` e adicionar `tickFormatter` para não quebrar linha, ou simplesmente aumentar a largura e usar `white-space: nowrap` via tick customizado. Solução mais direta: aumentar `width` para ~130.

### 2. Leads Prioritários — Botão WhatsApp

**Arquivo**: `src/pages/Dashboard.tsx` (linhas 237-242)

O `WhatsAppButton` usa variante `default` que renderiza um botão `outline` com texto "WhatsApp" e largura `w-full`. A classe `h-9 w-9 p-0 rounded-full` conflita com o conteúdo (texto + ícone). Solução: passar `variant="icon"` para renderizar apenas o ícone, e ajustar o className para o círculo correto.

### 3. AI Insights — Texto escuro

**Arquivo**: `src/pages/Dashboard.tsx` (linha 173)

O texto usa `text-accent` que é escuro no tema dark. Trocar para `text-[#a6c8e1]` (azul claro da paleta).

---

### Resumo das edições (todas em `src/pages/Dashboard.tsx`)

| Linha | Mudança |
|-------|---------|
| 193 | `width={90}` → `width={130}` |
| 173 | `text-accent` → `text-[#a6c8e1]` |
| 237-241 | Adicionar `variant="icon"` ao WhatsAppButton e ajustar className |

