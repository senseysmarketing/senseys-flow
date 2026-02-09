
## Editar/Excluir Eventos + Otimizacao Mobile da Agenda

### 1. Editar e Excluir Eventos

**No modal de detalhes do evento** (Event Detail Dialog), adicionar dois botoes: "Editar" e "Excluir".

- **Editar**: Abre o mesmo dialog de criacao, porem pre-preenchido com os dados do evento selecionado. O `handleSubmit` sera refatorado para detectar se esta editando (tem `editingEventId`) ou criando, e usar `update` ou `insert` conforme o caso.
- **Excluir**: Exibe um `AlertDialog` de confirmacao antes de deletar. Ao confirmar, executa `supabase.from('events').delete().eq('id', eventId)` e atualiza a lista.

**Novos states**:
- `editingEventId: string | null` para controlar modo edicao
- `isDeleteConfirmOpen: boolean` para o dialog de confirmacao

**Mudancas no handleSubmit**:
- Se `editingEventId` existe, faz `.update({...}).eq('id', editingEventId)` em vez de `.insert()`
- O titulo do dialog muda para "Editar Evento" quando em modo edicao

### 2. Otimizacao Mobile

O problema visivel no screenshot: sidebar e grid principal tentam renderizar lado a lado em telas pequenas, causando overflow e conteudo cortado.

**Mudancas de layout**:

- **Container principal**: trocar `h-[calc(100vh-120px)]` por layout responsivo. No mobile, permitir scroll natural com `pb-24` (para nao ser coberto pelo BottomNav).
- **Sidebar + Grid**: No mobile (`isMobile`), esconder a sidebar completamente e mostrar apenas o mini-calendario inline no topo + lista de eventos do dia selecionado abaixo.
- **Grid do calendario**: No mobile, esconder o grid mensal grande e mostrar apenas a lista de eventos do dia selecionado, pois o mini-calendario ja faz a navegacao.
- **Header**: Compactar no mobile -- texto menor, botoes menores, `gap-2` em vez de `gap-4`.

**Estrutura mobile**:
```
[Header compacto: Hoje | < > | Mes Ano | + Criar]
[Mini calendario (largura total)]
[Lista de eventos do dia selecionado]
```

**Estrutura desktop** (sem mudancas):
```
[Header]
[Sidebar (mini cal + eventos) | Grid mensal grande]
```

### Arquivo a Modificar

**`src/pages/Calendar.tsx`**

### Resumo das Mudancas

1. Importar `useIsMobile`, `AlertDialog` components, `Pencil` e `Trash2` icons
2. Adicionar states `editingEventId` e `isDeleteConfirmOpen`
3. Criar funcao `handleEdit(event)` que preenche o form e abre o dialog em modo edicao
4. Criar funcao `handleDelete(eventId)` que deleta o evento no Supabase
5. Refatorar `handleSubmit` para suportar update alem de insert
6. Adicionar botoes Editar/Excluir no modal de detalhes do evento
7. Adicionar `AlertDialog` de confirmacao de exclusao
8. Condicionar layout com `isMobile`: mobile mostra mini-cal + lista; desktop mostra sidebar + grid
9. Aplicar `pb-24` no mobile para o BottomNav
