
## Ajustar Modal de Detalhes do Evento no Mobile

### Problema

O modal de detalhes do evento usa o `DialogContent` padrao, que no mobile abre em tela cheia (comportamento definido em `dialog.tsx`). Para um modal com tao pouco conteudo (titulo, horario, local, lead), tela cheia desperdi&ccedil;a muito espaco e fica visualmente ruim, como mostra o screenshot.

### Solucao

Adicionar uma classe customizada ao `DialogContent` do Event Detail Dialog para que, no mobile, ele apareca como um card compacto centralizado ou sheet parcial, em vez de tela cheia.

### Arquivo a Modificar

**`src/pages/Calendar.tsx`** (linha 750)

### Mudanca

No `DialogContent` do Event Detail Dialog, sobrescrever os estilos mobile para que o modal fique compacto:

```
<DialogContent className="sm:max-w-[400px] inset-auto bottom-4 left-4 right-4 top-auto rounded-xl translate-x-0 translate-y-0 max-h-[70vh] sm:left-[50%] sm:top-[50%] sm:bottom-auto sm:right-auto sm:translate-x-[-50%] sm:translate-y-[-50%]">
```

Isso fara o modal aparecer como um card na parte inferior da tela no mobile, sem ocupar a tela toda, mantendo o comportamento desktop inalterado.
