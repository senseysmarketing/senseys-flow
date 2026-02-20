
## UI: Melhorias Visuais na Seção de Follow-up Automático

### O que será feito

Dois ajustes no bloco de follow-up em `WhatsAppIntegrationSettings.tsx` (linhas 852–925), espelhando o visual já aplicado na Saudação Automática:

---

### 1. Adicionar borda e fundo em cada "Etapa X"

**Situação atual:** Cada etapa é separada apenas por uma linha (`border-t`), sem container visual próprio.

**Novo comportamento:** Cada etapa ganha um container com `border rounded-lg bg-muted/20 p-4`, idêntico ao estilo dos itens de regras condicionais da saudação — criando uma hierarquia visual clara entre as etapas.

**Antes:**
```tsx
<div className={`space-y-3 ${index > 0 ? 'border-t pt-3' : ''} ${index < followUpSteps.length - 1 ? 'pb-3' : ''}`}>
```

**Depois:**
```tsx
<div className="border rounded-lg bg-muted/20 p-4 space-y-3">
```

O `space-y-0` do container pai vira `space-y-3` para separação entre cards.

---

### 2. Botão "Personalizar Templates" apenas na Etapa 1

**Situação atual:** O botão "Personalizar Templates" aparece abaixo do select de template em **todas** as etapas (linha 900–902).

**Novo comportamento:** O botão só aparece quando `index === 0` (Etapa 1), usando uma condição simples:

```tsx
{index === 0 && (
  <Button variant="outline" size="sm" className="h-auto px-3 py-1.5 text-xs" onClick={() => setShowTemplatesModal(true)}>
    <Settings2 className="h-3 w-3 mr-1" />
    Personalizar Templates
  </Button>
)}
```

O estilo será `variant="outline"` com `size="sm"` — igual ao botão da saudação, em vez do `variant="link"` atual.

---

### Arquivo a modificar

**`src/components/whatsapp/WhatsAppIntegrationSettings.tsx`** — linhas 852–925: ajustar container de cada etapa e condicionar o botão de templates.

---

### Resultado visual esperado

```text
┌─────────────────────────────────────────────────────────────────┐
│ ↺ Follow-up Automático                                          │
│   Mensagens de acompanhamento para leads que não responderam    │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ [●] Etapa 1                                          [🗑] │   │
│  │  Template de Mensagem         Delay após etapa anterior   │   │
│  │  [[Senseys] 1º Fo up - V1 ▼]  [2 horas ▼]               │   │
│  │  [ ⚙ Personalizar Templates ]                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ [●] Etapa 2                                          [🗑] │   │
│  │  Template de Mensagem         Delay após etapa anterior   │   │
│  │  [[Senseys] 2º Fo up - V1 ▼]  [24 horas ▼]              │   │
│  │  (sem botão de Personalizar)                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│  [ + Adicionar Etapa de Follow-up ]                             │
└─────────────────────────────────────────────────────────────────┘
```
