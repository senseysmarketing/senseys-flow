

## Corrigir botao "Lead" no modal de chat do WhatsApp

### Problema
O botao "Lead" no header do chat dentro do `WhatsAppChatModal` nao faz nada porque o callback `onShowLead` esta definido como uma funcao vazia: `() => {}`.

### Solucao
Passar um callback funcional que abra o modal de detalhes do lead (`LeadDetailModal`) ao clicar no botao.

### Implementacao

**Arquivo: `src/components/leads/WhatsAppChatModal.tsx`**

1. Adicionar uma prop `onShowLead` ao componente, permitindo que o componente pai (card do lead) passe a acao de abrir o `LeadDetailModal`
2. Usar essa prop no `ChatView` em vez da funcao vazia

Mudancas:
- Adicionar `onShowLead?: () => void` na interface `WhatsAppChatModalProps`
- Substituir `onShowLead={() => {}}` por `onShowLead={() => { if (onShowLead) onShowLead(); }}` na chamada ao `ChatView`

**Arquivos que chamam o `WhatsAppChatModal`** (cards de lead no Kanban e tabela):
- Passar o callback `onShowLead` que fecha o chat modal e abre o `LeadDetailModal` para o lead correspondente

Sera necessario verificar como o `LeadDetailModal` e aberto atualmente nos componentes pai para reutilizar a mesma logica.

### Secao tecnica

Os componentes que renderizam `WhatsAppChatModal` precisarao:
1. Receber ou ter acesso ao estado que controla a abertura do `LeadDetailModal`
2. Passar `onShowLead={() => { setWhatsAppModalOpen(false); setSelectedLeadId(leadId); }}` como prop

Isso garante que ao clicar em "Lead", o modal de chat fecha e o modal de detalhes do lead abre, mantendo o fluxo natural de navegacao.
