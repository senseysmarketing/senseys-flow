

## Mover Toggle da IA para a tela de Leads (LeadsSettingsSheet)

### Situação Atual
O `AiFunnelToggle` está na página `Settings.tsx`, mas o usuário quer que ele fique acessível diretamente na tela de Leads, dentro do `LeadsSettingsSheet` (o menu de configurações de leads).

### Plano

#### 1. Adicionar item "IA de Avanço" no `LeadsSettingsSheet`

- Adicionar novo item `"ai-toggle"` no array `settingsItems` com ícone `Brain`, label "IA de Avanço Automático" e descrição "Ative a IA para avançar leads no funil automaticamente"
- Posicionar antes de "Logs da IA" para ficarem agrupados
- Adicionar entrada no `modalConfig` e no `renderModalContent` para renderizar o `AiFunnelToggle` dentro do modal

#### 2. Atualizar tipos e imports

- Adicionar `"ai-toggle"` ao tipo `SettingsTab`
- Importar `AiFunnelToggle` no `LeadsSettingsSheet`
- Atualizar `modalConfig` com entrada para `"ai-toggle"` (max-w-lg, título "IA de Avanço Automático")

#### 3. Remover da Settings.tsx (opcional)

- Remover o `AiFunnelToggle` da página `Settings.tsx` para evitar duplicação, ou manter em ambos os locais para acesso via Settings também

### Detalhes Técnicos

- Arquivo principal: `src/components/leads/LeadsSettingsSheet.tsx`
- O `AiFunnelToggle` já é um componente self-contained que busca e atualiza `accounts.ai_funnel_enabled` — basta renderizá-lo dentro do modal
- Também corrigir o erro de build do `main.tsx` (duplicate data-lov-id) reescrevendo o arquivo

