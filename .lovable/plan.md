

## Fazer os cards de estatisticas refletirem os filtros aplicados

### Problema atual
O componente `LeadsHeroStats` recebe `leads` (lista completa, sem filtros), entao os cards de Total, Quentes, Mornos e Frios sempre mostram os numeros globais, ignorando o filtro de periodo e todos os outros filtros avancados.

### Solucao
Trocar `leads` por `filteredLeads` na prop do `LeadsHeroStats` na linha 912 de `src/pages/Leads.tsx`:

```
- <LeadsHeroStats leads={leads} ...
+ <LeadsHeroStats leads={filteredLeads} ...
```

Isso faz com que **todos os filtros** (periodo, corretor, imovel, campanha, etc.) sejam refletidos nos cards de estatisticas, nao apenas o filtro de periodo.

### Arquivo a modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Leads.tsx` | Linha 912: trocar `leads` por `filteredLeads` |

### Comportamento esperado
- Sem filtros: cards mostram totais globais (como hoje)
- Com filtro de periodo (ex: 27/02 a 04/03): cards mostram apenas os numeros daquele periodo
- Clicar num card de temperatura continua funcionando normalmente como filtro adicional

