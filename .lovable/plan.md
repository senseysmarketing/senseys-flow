

## Mover TemperatureBadge para a linha de tags

Mudanca simples em `LeadKanbanCard.tsx`:

1. **Remover** o `TemperatureBadge` do header (linha 92, ao lado do nome)
2. **Adicionar** o `TemperatureBadge` na tags row (linha 142-156), ao lado do `OriginBadge`, com `showLabel={true}` e `size="sm"` para exibir icone + texto (ex: "Quente" com icone de fogo)
3. **Garantir** que a tags row sempre renderize quando houver `temperatura` ou `origem` — atualizar a condicao do bloco para incluir `lead.temperature`

Resultado: origem e temperatura ficam lado a lado na mesma linha de tags, ambos como badges pequenos.

