

## Diferenciar Botões WhatsApp no Modal de Lead

### Problema
No header do modal, há um botão "WhatsApp" que abre o `wa.me` (WhatsApp Web externo). Logo abaixo, há uma aba "WhatsApp" que mostra o chat inline. Ambos usam o mesmo ícone `MessageCircle` e o mesmo texto "WhatsApp", gerando confusão e redundância.

### Solução

**Botão do header (linha 333-345)** — Mudar para indicar claramente que abre o WhatsApp Web externo:
- Trocar o texto de "WhatsApp" para "Abrir no WhatsApp" ou "WhatsApp Web"
- Adicionar o ícone `ExternalLink` (já importado) ao lado, para indicar que abre em nova aba
- Manter o `MessageCircle` como ícone principal mas adicionar o `ExternalLink` como indicador visual secundário

**Aba de navegação (linha 377-387)** — Renomear para "Conversas" ou "Chat" para diferenciar:
- Trocar o texto de "WhatsApp" para "Chat"
- Isso deixa claro que é o chat integrado, não um link externo

### Arquivo: `src/components/LeadDetailModal.tsx`

| Local | De | Para |
|-------|----|------|
| Linha 333-345 (botão header) | `<MessageCircle />` + "WhatsApp" | `<ExternalLink className="h-4 w-4" />` + "WhatsApp Web" |
| Linha 377-387 (aba) | `<MessageCircle />` + "WhatsApp" | `<MessageCircle />` + "Chat" |

