
## Plano de Ajuste das Seções do Dashboard no Mobile

### Problema Identificado

Analisando a screenshot, as seguintes seções estão com elementos cortados no mobile:

1. **Leads Recentes** (linhas 262-297 do Dashboard.tsx): Nomes longos como "Alan Ely - Consultoria & Assessoria de..." e badges "Novo Lead" estão sendo cortados porque todos os elementos (nome, indicador de temperatura, badge de status) estão na mesma linha horizontal.

2. **Agenda de Hoje** (linhas 328-346): Títulos de eventos longos podem ser cortados.

3. **Top Corretores** - Já foi corrigido com prop `compact` no commit anterior.

4. **Imóveis em Destaque** - Títulos longos podem ser cortados quando há muitos indicadores.

### Solução

Aplicar a mesma estratégia usada no `QuickLeadActions.tsx`: usar o hook `useIsMobile` e reorganizar o layout para ser vertical no mobile, similar ao padrão já estabelecido.

### Mudanças Necessárias

#### Arquivo: `src/pages/Dashboard.tsx`

**Mudança 1**: Na seção "Leads Recentes" (linhas 262-297)
- Reorganizar para que no mobile o nome fique em uma linha e as informações de status/origem em outra
- Usar `flex-wrap` para permitir que badges quebrem linha

```typescript
// DE (linha 265):
<div 
  className="flex items-center gap-3 p-3 rounded-lg..."
>
  <AvatarFallbackColored name={lead.name} size="sm" />
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2">
      <h4 className="font-medium text-sm truncate">{lead.name}</h4>
      {lead.temperature && (...)}
      {lead.status_name && (<Badge>...</Badge>)}
    </div>
    <p className="text-xs text-muted-foreground">...</p>
  </div>
  <ChevronRight />
</div>

// PARA:
<div 
  className={cn(
    "p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group",
    isMobile ? "flex flex-col gap-2" : "flex items-center gap-3"
  )}
>
  <div className="flex items-center gap-3">
    <AvatarFallbackColored name={lead.name} size="sm" />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <h4 className="font-medium text-sm truncate max-w-[160px]">{lead.name}</h4>
        {lead.temperature && (...)}
      </div>
      <div className="flex items-center gap-2 flex-wrap mt-0.5">
        <p className="text-xs text-muted-foreground">
          {lead.origem || 'Origem não informada'} • {getRelativeTime(lead.created_at)}
        </p>
        {lead.status_name && (<Badge>...</Badge>)}
      </div>
    </div>
    {!isMobile && <ChevronRight />}
  </div>
</div>
```

**Mudança 2**: Na seção "Agenda de Hoje" (linhas 328-346)
- Aplicar layout similar para eventos com títulos longos

```typescript
// Ajustar para usar flex-wrap e truncate adequado
<div className={cn(
  "p-3 rounded-lg bg-warning/5 border border-warning/20",
  isMobile ? "flex flex-col gap-2" : "flex items-center gap-3"
)}>
  <div className="flex-shrink-0 text-center">
    <div className="text-lg font-bold text-warning">{formatTime(event.start_time)}</div>
  </div>
  <div className="flex-1 min-w-0">
    <h4 className="font-medium text-sm truncate">{event.title}</h4>
    {event.lead_name && (
      <p className="text-xs text-muted-foreground truncate">
        Lead: {event.lead_name}
      </p>
    )}
  </div>
</div>
```

#### Arquivo: `src/components/dashboard/PropertyHighlights.tsx`

**Mudança**: Ajustar o layout dos cards de imóveis para mobile (linhas 153-187)

```typescript
// Usar layout vertical no mobile para evitar cortes
<div
  className={cn(
    "p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer",
    isMobile ? "flex flex-col gap-2" : "flex items-center gap-3"
  )}
>
  <div className="flex items-center gap-3 flex-1 min-w-0">
    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary...">
      {index + 1}
    </div>
    <div className="flex-1 min-w-0">
      <h4 className="font-medium text-sm truncate">{property.title}</h4>
      <p className="text-xs text-muted-foreground truncate">...</p>
    </div>
  </div>
  <div className={cn("flex items-center gap-3", isMobile && "justify-end")}>
    {/* Metrics */}
  </div>
</div>
```

### Resumo das Alterações

| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `src/pages/Dashboard.tsx` | Layout responsivo nas seções "Leads Recentes" e "Agenda de Hoje" |
| `src/components/dashboard/PropertyHighlights.tsx` | Layout responsivo nos cards de imóveis |

### Padrão de Design Mobile

O padrão estabelecido para cards no mobile é:

```text
+----------------------------------+
| [Avatar/Rank] [Nome truncado]    |
|              Info secundária     |
|                                  |
| [Badges/Métricas à direita]      |
+----------------------------------+
```

Em vez de tudo na mesma linha horizontal:
```text
+-----------------------------------------------------+
| [Avatar] [Nome...] [Badge] [Metric] [Metric] [>]    | <- CORTA
+-----------------------------------------------------+
```

### Impacto

- **Risco**: Baixo - apenas ajustes de layout CSS condicionais ao mobile
- **Tempo estimado**: 10 minutos
- **Benefício**: Todas as seções do Dashboard visíveis e funcionais no mobile
