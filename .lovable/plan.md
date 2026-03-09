

## Adicionar porcentagem nos cards de temperatura

Adicionar a porcentagem de cada categoria (quentes, mornos, frios, sem corretor) em relacao ao total, exibida ao lado do indicador de "hoje".

### Mudancas

**Arquivo: `src/components/leads/LeadsHeroStats.tsx`**

1. Adicionar campo `percentage` ao array `stats` para hot, warm, cold e unassigned:
   - `percentage = total > 0 ? Math.round((value / total) * 100) : 0`
   - O card "Total" nao recebe porcentagem (seria sempre 100%)

2. Renderizar a porcentagem abaixo ou ao lado do trend "hoje", com estilo discreto:
   - Exibir como `20%` com texto `text-xs text-muted-foreground`
   - Posicionar na mesma area dos trends, como uma linha adicional

Layout do card ficara:
```
QUENTES
24
0 hoje · 20%
```

Ou se tiver trend positivo:
```
QUENTES  
24
+2 hoje · 20%
```

