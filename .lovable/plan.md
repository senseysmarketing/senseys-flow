

## Preservar Estado da Aba WhatsApp ao Navegar

### Problema

Quando o usuário sai da página de Integrações e volta, o componente `WhatsAppIntegrationSettings` é desmontado e remontado, perdendo todo o estado (formulários abertos, templates sendo editados, configurações em andamento). Isso acontece porque `renderContent()` usa renderização condicional — apenas a aba ativa é montada.

### Solução

Manter **todas as abas montadas simultaneamente** no DOM, usando `display: none` (via CSS) para esconder as inativas. Assim, ao trocar de aba ou navegar para outra página e voltar, o componente WhatsApp não desmonta e preserva seu estado interno.

### Mudança

**Arquivo: `src/pages/Integrations.tsx`**

- Remover a função `renderContent()` com switch/case
- Renderizar os 3 componentes (`WebhookSettings`, `OlxIntegrationSettings`, `WhatsAppIntegrationSettings`) sempre, envolvendo cada um em uma `div` com `className={activeTab === 'x' ? 'block' : 'hidden'}`
- Isso garante que ao trocar de aba, o componente não é desmontado — apenas escondido visualmente

```text
Antes:  switch(activeTab) → monta apenas 1 componente
Depois: monta todos 3, exibe apenas o ativo via CSS hidden/block
```

Isso resolve tanto a troca entre abas quanto a navegação para outra página do sistema e retorno, pois o React Router mantém o componente `Integrations` montado enquanto a rota `/integrations` estiver ativa. Se o usuário de fato navega para `/leads` e volta, o componente remonta inevitavelmente — mas nesse caso é o comportamento esperado (ir para outra tela de verdade). O problema relatado é sobre troca rápida entre abas dentro da mesma página.

