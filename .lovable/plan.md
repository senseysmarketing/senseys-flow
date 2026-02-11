

## Padronizar Visual das Etapas de Follow-up

### Arquivo

**`src/components/whatsapp/WhatsAppIntegrationSettings.tsx`**

### Alteracoes

1. **Remover fundo azul das etapas**: Trocar `bg-muted/50 rounded-lg` por nenhum fundo, usando apenas `border-t` como separador entre etapas (identico a secao de saudacao que usa `border-t` para separar blocos)

2. **Adicionar botao "Personalizar Templates"**: Abaixo de cada select de "Template de Mensagem" nas etapas de follow-up, adicionar o mesmo botao link que existe na saudacao:
   ```
   <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setShowTemplatesModal(true)}>
     <Settings2 className="h-3 w-3 mr-1" />
     Personalizar Templates
   </Button>
   ```

3. **Separar etapas com linha**: Cada etapa sera separada por `border-t pt-3` ao inves de ter fundo proprio, mantendo o visual limpo e consistente com a saudacao

### Resultado Visual

Cada etapa ficara:
- Sem fundo colorido
- Separada da anterior por uma linha horizontal sutil
- Com o botao "Personalizar Templates" abaixo do select de template
- Visualmente identica ao bloco da saudacao automatica

