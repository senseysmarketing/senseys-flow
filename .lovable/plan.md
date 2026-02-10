

## Padronizar Layout dos Follow-ups com a Saudacao

### O que muda

Inverter a ordem dos campos em cada etapa de follow-up para ficar **Template de Mensagem primeiro, Delay depois** (igual a saudacao), e adicionar **labels** ("Template de Mensagem" e "Delay") acima dos selects.

### Arquivo

**`src/components/whatsapp/WhatsAppIntegrationSettings.tsx`**

### Alteracoes

Na secao de follow-up steps (linhas 638-676), cada linha de etapa sera atualizada de:

```text
[Switch] [Delay select] [Template select] [Trash]
```

Para:

```text
[Switch]
  Template de Mensagem: [Template select]
  Delay:                [Delay select]
                                    [Trash]
```

Detalhes:
1. Adicionar `<Label>Template de Mensagem</Label>` acima do select de template (primeiro campo)
2. Adicionar `<Label>Delay</Label>` acima do select de delay (segundo campo)
3. Inverter a ordem: template vem primeiro, delay depois (mesma ordem da saudacao)
4. Manter o switch de ativar/desativar e o botao de remover no mesmo layout
5. Envolver cada campo em um `<div className="space-y-2">` para consistencia com a saudacao

O resultado visual ficara identico ao layout da saudacao automatica, com labels explicativos e a mesma ordem de campos.
