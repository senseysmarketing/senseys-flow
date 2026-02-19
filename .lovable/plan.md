
## Corrigir scroll vertical no modal "Gerenciar Templates de Mensagem"

### Diagnóstico

No arquivo `src/components/whatsapp/WhatsAppTemplatesModal.tsx`, a view de lista (List View) possui esta estrutura:

```
<div className="space-y-4">           ← sem altura máxima
  <Button> Novo Template </Button>
  <ScrollArea className="max-h-[300px]">  ← scroll apenas neste bloco
    lista de cards
  </ScrollArea>
  <div> Variáveis Disponíveis </div>  ← fora do scroll
</div>
```

O scroll está aplicado apenas na lista de cards (limitado a 300px), enquanto o botão "Novo Template" e a seção "Variáveis Disponíveis" ficam **fora** do scroll. Com muitos templates, o modal cresce sem limite vertical, ficando parcialmente fora da tela.

### Solução

Dois ajustes simultâneos:

**1. Dar altura máxima ao dialog inteiro:**
No `DialogContent`, adicionar `max-h-[90vh] flex flex-col` para garantir que o modal nunca ultrapasse a altura da tela.

**2. Envolver TODO o conteúdo da List View num único `ScrollArea`:**
Remover o `ScrollArea` interno que envolve apenas os cards e colocar um único `ScrollArea` envolvendo botão + lista + variáveis, com `max-h-[65vh]` ou equivalente.

Estrutura final:

```
<DialogContent className="!max-w-2xl max-h-[90vh] flex flex-col">
  <DialogHeader> ... </DialogHeader>

  <!-- List View -->
  <ScrollArea className="flex-1 overflow-auto">
    <div className="space-y-4 pr-1">
      <Button> Novo Template </Button>
      <div className="space-y-2">
        {templates.map(...)}
      </div>
      <div> Variáveis Disponíveis </div>
    </div>
  </ScrollArea>
```

### Arquivo a modificar

- **`src/components/whatsapp/WhatsAppTemplatesModal.tsx`** — apenas a List View (linhas ~293-360):
  - Adicionar `max-h-[90vh] flex flex-col` ao `DialogContent`
  - Substituir a estrutura atual por um único `ScrollArea` envolvendo todo o conteúdo da lista
  - Remover o `ScrollArea` interno que limitava apenas os cards a 300px
