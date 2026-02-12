

## Modal de Chat WhatsApp no Botao de Leads

### O que sera feito

Ao clicar no botao "WhatsApp" no card de lead (Kanban ou tabela), em vez de abrir diretamente o wa.me, o sistema abrira um modal com a conversa do WhatsApp integrada ao CRM. O modal tera deteccao inteligente do estado da conexao WhatsApp da conta.

### Fluxo de Decisao

```text
Clique no botao WhatsApp
       |
       v
  WhatsApp conectado?
     /        \
   SIM        NAO
    |           |
    v           v
  Modal com    Modal de aviso:
  chat do      - Icone ilustrativo
  lead em      - "Conecte seu WhatsApp para
  tempo real     enviar e receber mensagens
  (igual tela    diretamente pelo CRM"
  Conversas)   - Botao "Conectar WhatsApp"
               - Botao "Abrir WhatsApp Web"
                 (link wa.me tradicional)
```

### Detalhes da Implementacao

**1. Novo componente: `src/components/leads/WhatsAppChatModal.tsx`**

- Recebe props: `open`, `onClose`, `lead` (nome, telefone, id, propertyName)
- Ao abrir, consulta `whatsapp_sessions` para verificar se a conta tem WhatsApp conectado
- **Se conectado**: 
  - Busca ou cria a conversa pelo telefone do lead na tabela `whatsapp_conversations`
  - Renderiza o `ChatView` existente dentro do modal (reutiliza todo o componente de chat)
  - Usa o hook `useMessages` para carregar e enviar mensagens em tempo real
- **Se nao conectado**: 
  - Exibe tela de aviso com icone `WifiOff` ou `MessageCircle`
  - Texto explicativo sobre os beneficios da conexao (enviar/receber pelo CRM, automacoes, historico)
  - Botao primario "Conectar WhatsApp" que redireciona para `/settings` (aba WhatsApp)
  - Botao secundario "Abrir WhatsApp Web" que abre o link wa.me tradicional (comportamento atual)

**2. Alterar `src/components/WhatsAppButton.tsx`**

- Adicionar estado para controlar abertura do modal
- Em vez de chamar `window.open(wa.me...)` diretamente, abrir o `WhatsAppChatModal`
- Passar `leadName`, `leadId`, `phone` e `propertyName` para o modal

**3. Alterar `src/components/LeadKanbanCard.tsx`**

- Nenhuma mudanca necessaria - ja passa todas as props para o `WhatsAppButton`

### Estrutura do Modal

**Estado: WhatsApp Conectado**
- Header com nome do lead e telefone formatado
- Area de mensagens com scroll (reutiliza ChatView)
- Input de mensagem com templates rapidos
- Tamanho do modal: largura media (~600px), altura 80vh

**Estado: WhatsApp Nao Conectado**
- Layout centralizado com icone grande
- Titulo: "WhatsApp nao conectado"
- Descricao: "Conecte seu WhatsApp para conversar com seus leads diretamente pelo CRM, enviar mensagens automaticas e manter todo o historico centralizado."
- Lista de beneficios (icones + texto):
  - Envie e receba mensagens pelo CRM
  - Automacoes de saudacao e follow-up
  - Historico completo de conversas
- Botao verde: "Conectar WhatsApp" (vai para Settings)
- Botao outline: "Abrir no WhatsApp Web" (abre wa.me como antes)

### Detalhes Tecnicos

- O hook `useMessages` ja suporta buscar mensagens por `remote_jid` - precisaremos converter o telefone do lead para o formato de JID (`55DDXXXXXXXXX@s.whatsapp.net`)
- A verificacao de conexao usara uma query simples a `whatsapp_sessions` (mesma logica usada em `Leads.tsx` linha 373)
- O modal usara o componente `Dialog` existente com classe `!max-w-2xl` e altura controlada
- O `ChatView` sera reutilizado diretamente, passando `isMobile={false}`

