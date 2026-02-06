

## Remover Borda Lateral dos Cards de Insights

### Problema
Os cards de insight no `InsightsPanel` têm uma borda grossa de 4px à esquerda (`border-l-4`) que não está visualmente agradável.

### Solução
Remover o estilo `border-l-4` e as classes de cor de borda (`border-l-warning`, `border-l-success`, etc.) dos cards, mantendo apenas o background colorido sutil que já existe.

### Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/dashboard/InsightsPanel.tsx` | Remover `border-l-4` e classes `border-l-*` |

### Mudanças Específicas

**Antes (linhas 9-14):**
```typescript
const insightTypeStyles = {
  warning: "border-l-warning bg-warning/5",
  success: "border-l-success bg-success/5",
  info: "border-l-primary bg-primary/5",
  action: "border-l-destructive bg-destructive/5",
};
```

**Depois:**
```typescript
const insightTypeStyles = {
  warning: "bg-warning/10",
  success: "bg-success/10",
  info: "bg-primary/10",
  action: "bg-destructive/10",
};
```

**Antes (linha 115):**
```typescript
"flex items-start gap-3 p-3 rounded-lg border-l-4 transition-all",
```

**Depois:**
```typescript
"flex items-start gap-3 p-3 rounded-lg transition-all",
```

### Resultado Visual
- Cards com background sutil colorido (sem borda lateral)
- Visual mais limpo e moderno
- Ícone colorido continua indicando o tipo de insight

