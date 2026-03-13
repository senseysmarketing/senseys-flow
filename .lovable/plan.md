

## Refatoracao Visual Premium: 4 Componentes

Este e um redesign visual extenso que toca 4 areas do sistema. Vou detalhar cada mudanca.

---

### 1. Lead Detail: Dialog → Side Drawer (Sheet)

**Arquivo**: `src/components/LeadDetailModal.tsx` (742 linhas)

- **Substituir** `Dialog`/`DialogContent` por `Sheet`/`SheetContent` com `side="right"`
- **Container**: `bg-[#2b2d2c] border-l border-white/10`, largura `sm:max-w-[520px]`
- **Backdrop**: O Sheet ja aplica overlay escuro; adicionar `backdrop-blur-sm` no overlay
- **Entrada com Framer Motion**: Wrap do conteudo com `motion.div` e `animate={{ x: 0 }}` (slide da direita)
- **Header redesenhado**:
  - Avatar com iniciais usando `AvatarFallbackColored` + `shadow-[0_0_15px_rgba(129,175,209,0.3)]` (glow sutil)
  - Nome em `text-white text-2xl font-bold`
  - Botoes de acao rapida (WhatsApp e Ligar) como icones minimalistas com `text-[#a6c8e1] hover:text-white`
- **Corpo em Bento Layout**: Cada secao (Contato, Origem, Formulario) em mini-cards `bg-[#5a5f65] rounded-xl p-4` com icones `text-[#a6c8e1]`
- **Tabs (Detalhes/WhatsApp)**: Manter logica, estilizar com border-bottom `border-[#81afd1]` no ativo
- **Footer**: `bg-[#2b2d2c] border-t border-white/10`
- **Manter toda a logica funcional** (WhatsApp inline, duplicates, scheduled messages, etc.)

### 2. Property Cards Premium

**Arquivo**: `src/components/properties/PropertyMetricsCard.tsx` (276 linhas)

- **Card container**: `bg-[#5a5f65]/80 backdrop-blur-md border border-white/10 hover:border-[#81afd1]/30 hover:shadow-[0_0_20px_rgba(129,175,209,0.1)]`
- **Status badge "Disponivel"**: Trocar `bg-green-500 text-white` por `bg-transparent border border-emerald-400/50 text-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.2)]` (glow neon)
- **Metricas row**: Fundo `bg-black/20` com mini sparkline SVG na cor `#81afd1` ao lado do valor de investimento (usar Recharts `LineChart` compacto como ja feito no `BentoMetricCard`)
- **Preco**: `text-[#81afd1]` ao inves de `text-primary`
- **Botoes de acao**: Icones sutis com `text-[#a6c8e1] hover:text-white`, sem borders pesados
- **Textos**: `text-white` para titulos, `text-[#a6c8e1]` para labels

### 3. Integracoes: Estilo "Painel de IA"

**Arquivos**: `src/pages/Integrations.tsx` (87 linhas) + `src/components/whatsapp/WhatsAppIntegrationSettings.tsx` (1239 linhas)

**Integrations.tsx**:
- Header com icone glow `shadow-[0_0_12px_rgba(129,175,209,0.3)]`
- Tabs com fundo `bg-[#5a5f65]/50` e tab ativa com `bg-[#81afd1]/20 text-[#81afd1]`

**WhatsAppIntegrationSettings.tsx** (foco no Follow-up Timeline):
- **Switches ativos**: `data-[state=checked]:bg-[#81afd1] data-[state=checked]:shadow-[0_0_8px_rgba(129,175,209,0.4)]`
- **Timeline de Follow-up**: Transformar a lista de etapas em timeline vertical com:
  - Linha vertical `w-0.5 bg-[#a6c8e1]/30` conectando os passos
  - Pontos circulares `w-3 h-3 rounded-full bg-[#81afd1]` com glow quando ativos
  - `AnimatePresence` + `motion.div` com `initial={{ opacity: 0, y: -10 }}` ao adicionar etapas
- Cards de etapa com fundo `bg-[#5a5f65] border border-white/10`

### 4. Chat View: Bolhas Branded

**Arquivo**: `src/components/conversations/ChatView.tsx` (231 linhas)

- **Bolhas da imobiliaria** (is_from_me): `bg-[#81afd1] text-white rounded-br-sm`
- **Bolhas do cliente**: `bg-[#5a5f65] text-white rounded-bl-sm`
- **Timestamp**: `text-white/60` em ambas
- **Input bar**: `bg-[#2b2d2c]/80 backdrop-blur-md border-t border-white/10`
- **Botao enviar**: `bg-[#81afd1] hover:bg-[#81afd1]/80 hover:shadow-[0_0_12px_rgba(129,175,209,0.4)] hover:scale-105 transition-all`
- **Header**: `border-b border-white/10`, botao WhatsApp Web mantido em verde
- **Date separator**: `bg-[#5a5f65] text-[#a6c8e1]`

---

### Resumo de arquivos

| Arquivo | Escopo |
|---------|--------|
| `src/components/LeadDetailModal.tsx` | Dialog → Sheet, dark theme, bento layout |
| `src/components/properties/PropertyMetricsCard.tsx` | Glassmorphism, glow badges, sparklines |
| `src/pages/Integrations.tsx` | Tabs estilizadas, header glow |
| `src/components/whatsapp/WhatsAppIntegrationSettings.tsx` | Switches glow, timeline follow-up |
| `src/components/conversations/ChatView.tsx` | Bolhas branded, input translucido |

