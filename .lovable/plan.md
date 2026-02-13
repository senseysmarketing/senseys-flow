

## Adicionar botao "WhatsApp Web" no header do chat

### O que sera feito

Adicionar um botao verde com icone do WhatsApp ao lado esquerdo do botao "Lead" no header do `ChatView`. Ao clicar, abre o WhatsApp Web (`wa.me/{numero}`) em uma nova aba, permitindo que o usuario converse diretamente pelo WhatsApp caso prefira.

O botao aparecera tanto na tela de Conversas quanto no modal de chat do lead (`WhatsAppChatModal`).

### Detalhes tecnicos

**Arquivo: `src/components/conversations/ChatView.tsx`**

- Importar o icone `ExternalLink` do lucide-react
- Adicionar um botao verde compacto antes do botao "Lead" (linha ~111), com estilo `bg-green-600 hover:bg-green-700 text-white`
- O botao abre `https://wa.me/{phone}` em nova aba, usando o numero da conversa (ja disponivel em `conversation.phone` ou `conversation.lead?.phone`)
- Texto visivel em telas maiores: "WhatsApp Web", apenas icone em mobile

Posicionamento no header:
```text
[Avatar] [Nome / Telefone]  ............  [WhatsApp Web] [Lead] [X]
```

