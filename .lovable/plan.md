
## Redesign da Aba WhatsApp — Layout Modular com Hierarquia Clara

### Diagnóstico do Layout Atual

O componente `WhatsAppIntegrationSettings.tsx` (1066 linhas) possui 4 cards empilhados verticalmente em coluna única:
1. **Conexão WhatsApp** — card grande com botões de diagnóstico (Reconfigurar, Reiniciar, Desconectar) bem visíveis
2. **Saudação Automática** — card extenso com toggle, template, delay, sequência, fontes e regras condicionais
3. **Follow-up Automático** — cards idênticos empilhados sem indicação visual de fluxo sequencial
4. **Como Funciona** — card informativo no rodapé

### Problemas Identificados

- **Ruído visual**: Botões de diagnóstico técnico (Reconfigurar Webhook, Reiniciar Instância) aparecem na mesma hierarquia que ações principais
- **Fadiga de scroll**: Tudo em coluna única sem aproveitamento de espaço horizontal
- **Follow-up sem identidade de fluxo**: Cards de etapas são idênticos, não comunicam progressão
- **Card "Como Funciona"** ocupa espaço valioso na área de trabalho
- **Seção de Conexão**: ocupa muito espaço quando já está conectado (informação secundária)

---

### Solução Proposta

#### 1. Status Bar Compacta no Topo (em vez de card grande)

Transformar o card de conexão em uma barra horizontal compacta quando conectado. Quando desconectado, mantém o card para destacar a ação principal de conectar.

```
┌─────────────────────────────────────────────────────────┐
│ 🟢 Conectado · +55 (11) 99999-9999 · desde 18/02   [⋯] │
└─────────────────────────────────────────────────────────┘
```

O menu `[⋯]` (três pontinhos / `DropdownMenu`) agrupa as ações de diagnóstico: **Reconfigurar Webhook**, **Reiniciar Instância** e **Desconectar** — limpando completamente o visual do estado conectado.

#### 2. Grid de Duas Colunas (lg:grid-cols-2)

Em telas maiores (≥ 1024px), dividir em duas colunas:

```
┌──────────────────────┬──────────────────────┐
│   SAUDAÇÃO           │   FOLLOW-UP          │
│   (Coluna esquerda)  │   (Coluna direita)   │
│                      │                      │
│  Toggle + Template   │  ──○ Etapa 1         │
│  Delay               │     Template · 1h    │
│  Sequência           │      │               │
│  Fontes de Lead      │      ▼               │
│  ─────────────────   │  ──○ Etapa 2         │
│  Regras Condicionais │     Template · 24h   │
│  [+ Adicionar Regra] │      │               │
│                      │      ▼               │
│                      │  [+ Adicionar Etapa] │
└──────────────────────┴──────────────────────┘
```

Em mobile (< 1024px), as colunas se empilham normalmente.

#### 3. Follow-up como Timeline Visual

Em vez de cards idênticos, usar um design de **esteira/stepper** com linha vertical conectora:

```
  ● Etapa 1  [Switch ativo]  Template: "Olá Lead"  [🕐 1 hora]   [🗑]
  │
  │  (linha conectora vertical)
  │
  ● Etapa 2  [Switch ativo]  Template: "Seguindo"  [🕐 24 horas] [🗑]
  │
  ● [+ Adicionar Etapa]
```

Cada "nó" da timeline é um `div` com um dot colorido à esquerda e linha vertical entre eles. O dot fica verde se ativo, cinza se inativo.

#### 4. Indicador de Status nos Cards (borda lateral colorida)

Cards de automação ativa ganham uma borda lateral esquerda colorida via `border-l-4`:
- Verde (`border-l-green-500`) quando ativo
- Cinza (`border-l-muted`) quando inativo

#### 5. Card "Como Funciona" → Collapsible / removido

Mover para um `Collapsible` discreto no rodapé, fechado por padrão, com um link "Ver como funciona ↓". Reduz o scroll significativamente.

---

### Alterações Técnicas

#### Arquivo único a modificar:
**`src/components/whatsapp/WhatsAppIntegrationSettings.tsx`**

Novos imports necessários:
```ts
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MoreVertical, ChevronDown } from 'lucide-react';
```

#### Estrutura do JSX após redesign:

```jsx
<div className="space-y-4">

  {/* STATUS BAR — compacta quando conectado, card quando desconectado */}
  {isConnected ? (
    <div className="flex items-center justify-between px-4 py-2.5 rounded-lg border bg-card">
      <div className="flex items-center gap-2.5">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-sm font-medium">Conectado</span>
        {session?.phone_number && <span className="text-sm text-muted-foreground">· {session.phone_number}</span>}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleForceReconfigure}>Reconfigurar Webhook</DropdownMenuItem>
          <DropdownMenuItem onClick={handleRestartInstance}>Reiniciar Instância</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={handleDisconnect}>Desconectar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ) : (
    <Card> {/* card de conexão existente */ } </Card>
  )}

  {/* GRID 2 COLUNAS */}
  <div className="grid gap-4 lg:grid-cols-2">

    {/* COLUNA ESQUERDA: Saudação */}
    <Card className={cn("border-l-4", newLeadRule?.is_active ? "border-l-green-500" : "border-l-border")}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Saudação Automática</CardTitle>
          </div>
          <Switch checked={newLeadRule?.is_active} ... />
        </div>
      </CardHeader>
      <CardContent>
        {/* template + delay + sequência + fontes + regras */}
      </CardContent>
    </Card>

    {/* COLUNA DIREITA: Follow-up Timeline */}
    <Card className={cn("border-l-4", followUpSteps.some(s => s.is_active) ? "border-l-blue-500" : "border-l-border")}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Follow-up Automático</CardTitle>
        </div>
        <CardDescription className="text-xs">Leads que não responderam</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Timeline stepper */}
        <div className="relative">
          {followUpSteps.map((step, index) => (
            <div key={step.id} className="flex gap-3 pb-4 relative">
              {/* Linha conectora */}
              {index < followUpSteps.length - 1 && (
                <div className="absolute left-[7px] top-4 bottom-0 w-px bg-border" />
              )}
              {/* Dot */}
              <div className={cn(
                "w-3.5 h-3.5 rounded-full border-2 mt-0.5 shrink-0 z-10",
                step.is_active ? "bg-primary border-primary" : "bg-muted border-muted-foreground/30"
              )} />
              {/* Conteúdo da etapa */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Etapa {step.position + 1}</span>
                  <div className="flex items-center gap-1">
                    <Switch checked={step.is_active} ... />
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" ...>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {step.is_active && (
                  <div className="grid grid-cols-2 gap-2">
                    <Select ... /> {/* template */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <Select ... /> {/* delay */}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full mt-2" ...>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Etapa
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>

  {/* "COMO FUNCIONA" — Collapsible no rodapé */}
  <Collapsible>
    <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
      <ChevronDown className="h-3 w-3" />
      Como funciona a automação?
    </CollapsibleTrigger>
    <CollapsibleContent>
      {/* passos numerados existentes */}
    </CollapsibleContent>
  </Collapsible>

</div>
```

---

### Resumo de Impacto Visual

| Antes | Depois |
|---|---|
| 4 cards empilhados em coluna única | Status bar compacta + grid 2 colunas |
| Botões Reconfigurar/Reiniciar/Desconectar visíveis | Agrupados em menu ⋯ discreto |
| Follow-up: cards idênticos sem identidade de fluxo | Timeline com dots e linhas conectoras |
| "Como Funciona" sempre visível | Collapsible fechado por padrão |
| Sem indicação visual de status ativo/inativo | Borda lateral colorida nos cards |

Todo o estado, lógica e handlers permanecem intactos — apenas o JSX de renderização é reestruturado.
