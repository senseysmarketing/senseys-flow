

## Direcionar Icone de Notificacao para Configuracoes

### Mudanca

Adicionar `onClick` no botao do sino no header (`Layout.tsx`) para navegar ate `/settings` com a aba de notificacoes ativa.

### Arquivo a Modificar

**`src/components/Layout.tsx`**

### Detalhes

1. Importar `useNavigate` do `react-router-dom` (ja usa `Navigate` e `useLocation`)
2. Adicionar `const navigate = useNavigate()` no componente
3. No botao do `<Bell>`, adicionar `onClick={() => navigate('/settings?tab=notifications')}`

### Na pagina Settings

Verificar se `Settings.tsx` ja le o query param `tab` para definir a aba ativa. Se sim, nenhuma mudanca adicional. Se nao, adicionar essa logica.

