

## Vincular conversas ao numero de WhatsApp e adicionar permissao de acesso

### Problema

1. Conversas ficam visiveis mesmo apos desconectar o WhatsApp
2. Se conectar um numero diferente, conversas antigas do numero anterior continuam aparecendo
3. Todos os usuarios do CRM tem acesso as conversas (incluindo conversas pessoais acidentais)

### Solucao em 3 partes

---

### Parte 1: Vincular conversas ao numero conectado

**Migracoes no banco de dados:**

- Adicionar coluna `session_phone` (text, nullable) na tabela `whatsapp_conversations` para armazenar o numero do WhatsApp que originou a conversa
- Adicionar coluna `session_phone` (text, nullable) na tabela `whatsapp_messages` para o mesmo proposito
- Preencher retroativamente as conversas existentes com o `phone_number` atual da `whatsapp_sessions` da respectiva conta

**Edge function `whatsapp-webhook`:**

- Ao criar/atualizar conversas e mensagens, gravar o `phone_number` da sessao ativa no campo `session_phone`

**Hook `use-conversations.tsx`:**

- Ao buscar conversas, primeiro verificar se ha sessao conectada e obter o `phone_number`
- Se conectado: filtrar conversas pelo `session_phone` correspondente ao numero atual
- Se desconectado: retornar lista vazia (nenhuma conversa visivel)

Isso garante que:
- Ao trocar de numero, so aparecem conversas do numero novo (ou as que ja foram salvas com aquele numero anteriormente)
- Ao desconectar, a tela fica "em branco" sem deletar nenhum dado
- Ao reconectar o mesmo numero, todas as conversas antigas reaparecem

---

### Parte 2: Permissao de acesso a Conversas

**Migracoes no banco de dados:**

- Inserir nova permissao na tabela `permissions`:
  - `key: 'conversations.view'`, `name: 'Ver conversas'`, `category: 'conversations'`
- Atribuir essa permissao automaticamente aos perfis Proprietario e Gerente nos roles existentes (inserir em `role_permissions` para cada conta)

**Pagina de Conversas (`src/pages/Conversations.tsx`):**

- Antes de renderizar, verificar `hasPermission('conversations.view')` usando o hook `usePermissions`
- Se nao tiver permissao, mostrar tela de "Acesso restrito" com mensagem explicando que o usuario nao tem permissao

**Menu lateral (`src/components/AppSidebar.tsx` e `src/components/BottomNav.tsx`):**

- Condicionar a exibicao do item "Conversas" no menu a `hasPermission('conversations.view')`

**Tela de Permissoes (`src/components/RolePermissionsManager.tsx`):**

- A nova permissao `conversations.view` aparecera automaticamente na interface de gerenciamento de permissoes por usar a tabela `permissions` dinamicamente

---

### Parte 3: Tela de Conversas quando desconectado

**Hook `use-conversations.tsx`:**

- Exportar o estado de conexao (`isWhatsAppConnected`) junto com as conversas
- Quando desconectado, retornar `conversations: []` e `isConnected: false`

**Pagina `src/pages/Conversations.tsx`:**

- Quando `isConnected === false`, renderizar uma tela vazia amigavel:
  - Icone de WifiOff
  - Titulo "WhatsApp nao conectado"
  - Descricao "Conecte seu WhatsApp nas configuracoes para ver e gerenciar suas conversas"
  - Botao "Ir para Configuracoes" que navega para `/settings`

---

### Resumo dos arquivos alterados

| Arquivo | Mudanca |
|---|---|
| Migracao SQL | Adicionar `session_phone` em `whatsapp_conversations` e `whatsapp_messages`, nova permissao `conversations.view` |
| `supabase/functions/whatsapp-webhook/index.ts` | Gravar `session_phone` ao criar conversas/mensagens |
| `src/hooks/use-conversations.tsx` | Filtrar por `session_phone` do numero conectado, expor `isConnected` |
| `src/pages/Conversations.tsx` | Tela de desconectado e verificacao de permissao |
| `src/components/AppSidebar.tsx` | Condicionar item "Conversas" a permissao |
| `src/components/BottomNav.tsx` | Condicionar item "Conversas" a permissao |

