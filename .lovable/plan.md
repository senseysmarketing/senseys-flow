
## Ajustes Visuais: Remover Bordas Coloridas e Expandir Largura da Página

### Problemas Identificados

**Problema 1 — Largura limitada:** Em `src/pages/Integrations.tsx` (linha 82), o wrapper do conteúdo usa `max-w-4xl` (896px máximo), o que trava o layout nesse tamanho independente da resolução da tela.

**Problema 2 — Bordas coloridas:** Em `src/components/whatsapp/WhatsAppIntegrationSettings.tsx`, dois cards têm bordas laterais condicionais:
- Linha 540: `<Card className={cn("border-l-4", newLeadRule?.is_active ? "border-l-green-500" : "border-l-border")}>` — card Saudação Automática
- Linha 821: `<Card className={cn("border-l-4", followUpSteps.some(s => s.is_active) ? "border-l-blue-500" : "border-l-border")}>` — card Follow-up Automático

---

### Solução

#### Mudança 1 — `src/pages/Integrations.tsx`

Remover o `max-w-4xl` do wrapper de conteúdo para que o layout ocupe a largura disponível:

```tsx
// ANTES:
<div className="max-w-4xl">
  {renderContent()}
</div>

// DEPOIS:
<div className="w-full">
  {renderContent()}
</div>
```

#### Mudança 2 — `src/components/whatsapp/WhatsAppIntegrationSettings.tsx`

Remover as classes de borda lateral colorida dos dois cards, mantendo apenas o estilo padrão de card:

```tsx
// ANTES (linha 540):
<Card className={cn("border-l-4", newLeadRule?.is_active ? "border-l-green-500" : "border-l-border")}>

// DEPOIS:
<Card>
```

```tsx
// ANTES (linha 821):
<Card className={cn("border-l-4", followUpSteps.some(s => s.is_active) ? "border-l-blue-500" : "border-l-border")}>

// DEPOIS:
<Card>
```

---

### Impacto

| Aspecto | Antes | Depois |
|---|---|---|
| Largura do conteúdo | Limitado a 896px (max-w-4xl) | Preenche toda a largura disponível |
| Cards do WhatsApp | Borda verde/azul lateral de 4px | Sem borda colorida lateral |
| Layout responsivo | Estático em 896px | Adapta-se ao tamanho da tela |

Apenas 3 linhas de código alteradas em 2 arquivos. Toda a lógica, estados e handlers permanecem intactos.
