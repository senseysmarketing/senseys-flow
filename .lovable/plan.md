

## Simplificar Navegacao da Pagina de Configuracoes

### O que muda

Remover a estrutura de dois niveis (categorias "Geral", "Integracoes", "Avancado" + sub-tabs) e colocar todas as tabs em uma unica linha, ja que agora sao poucas opcoes.

### Tabs finais (em uma linha)

Perfil | Equipe | Notificacoes | Webhook | WhatsApp | Permissoes | White Label

### Arquivo a modificar

**`src/pages/Settings.tsx`**

### Mudancas

1. **Remover a estrutura de categorias**: eliminar `CategoryValue`, `NavGroup`, `navGroups`, `activeCategory`, `handleCategoryChange`, `currentCategoryGroup`, `currentCategoryItems`, e o array `categories`
2. **Criar um array flat de tabs**: lista unica com todos os itens (profile, team, notifications, webhook, whatsapp-integration, permissions, whitelabel), cada um com label, icone e permissao opcional
3. **Simplificar `renderDesktopTabs`**: um unico `Tabs` + `TabsList` com todos os itens em uma linha
4. **Simplificar `renderMobileTabs`**: um unico `TabsList` com flex-wrap para acomodar em telas pequenas
5. **Manter `renderContent` e todo o restante intacto** -- apenas a navegacao muda

### Resultado

Interface mais limpa e direta, sem necessidade de navegar entre categorias para acessar as opcoes de configuracao.
