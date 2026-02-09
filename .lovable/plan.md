
## Centralizar Modal de Detalhes do Evento no Mobile

### Problema

O modal esta fixo na parte inferior da tela porque as classes `bottom-4` e `top-auto` o ancoram la embaixo. Ele precisa ficar centralizado na tela, como um card compacto.

### Solucao

Trocar as classes do `DialogContent` do Event Detail Dialog para centralizar o modal no mobile tambem, sobrescrevendo o comportamento fullscreen padrao do `dialog.tsx`.

### Arquivo a Modificar

**`src/pages/Calendar.tsx`** (linha 750)

### Mudanca

Substituir as classes atuais por:

```
<DialogContent className="sm:max-w-[400px] !inset-auto !top-[50%] !left-[50%] !translate-x-[-50%] !translate-y-[-50%] !rounded-xl !w-[calc(100%-2rem)] !max-h-[70vh] !p-6 !pt-8">
```

Isso usa `!important` via Tailwind para sobrescrever os estilos base do `dialog.tsx` que forcam fullscreen no mobile, garantindo que o modal fique centralizado e compacto em qualquer tamanho de tela.
