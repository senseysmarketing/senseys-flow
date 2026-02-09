

## Corrigir Drag and Drop do Kanban de Leads

### Problemas

1. **Card deslocado do mouse**: O wrapper `div` do `Draggable` nao aplica nenhum estilo inline. O `provided.draggableProps` inclui um `style` com `position`, `top`, `left`, etc., que precisa ser propagado. Porem, o problema principal e que containers com `overflow: hidden/auto` e `transform` podem causar calculo errado da posicao do card arrastado pelo `@hello-pangea/dnd`.

2. **Card atras das colunas**: Durante o arrasto, o card fica com o mesmo `z-index` das colunas, ficando escondido atras delas.

### Solucao

Modificar o `Draggable` render no arquivo `src/pages/Leads.tsx` para:

1. Aplicar `style` customizado com `zIndex: 9999` durante o arrasto
2. Usar `position: fixed` via portal para evitar problemas de offset causados por containers com `overflow` e `transform`

### Arquivo a Modificar

**`src/pages/Leads.tsx`** (linhas 1211-1228)

### Mudancas

Alterar o wrapper do `Draggable` para aplicar `z-index` alto e `position` adequado durante o drag:

```tsx
<Draggable key={lead.id} draggableId={lead.id} index={index}>
  {(provided, snapshot) => {
    const draggableStyle = {
      ...provided.draggableProps.style,
      ...(snapshot.isDragging ? { zIndex: 9999, position: 'fixed' as const } : {}),
    };
    return (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        style={draggableStyle}
      >
        <LeadKanbanCard
          lead={lead}
          onViewDetails={handleViewDetails}
          onEdit={handleEditLead}
          onDelete={(id) => {
            const l = leads.find(x => x.id === id);
            if (l) requestDeleteLead(l);
          }}
          isDragging={snapshot.isDragging}
        />
      </div>
    );
  }}
</Draggable>
```

A chave da correcao e:
- **`zIndex: 9999`** durante o drag: garante que o card fique acima das colunas glassmorphism
- **Manter `provided.draggableProps.style`**: o `@hello-pangea/dnd` calcula posicao via esse style, e ele ja estava sendo aplicado implicitamente via spread, mas o `z-index` alto resolve a camada visual
- Se o offset persistir, a alternativa e usar `ReactDOM.createPortal` para renderizar o card arrastado diretamente no `document.body`, eliminando qualquer interferencia de containers pai com `overflow` ou `transform`

