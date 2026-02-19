
## Reorganizar Configurações: criar item "Integrações" no menu lateral

### O que será feito

Atualmente as abas Webhook, Grupo OLX e WhatsApp ficam misturadas com Perfil, Equipe, Notificações, etc. na mesma barra horizontal de Configurações.

A proposta é criar uma **nova entrada "Integrações"** no menu lateral da sidebar (entre "Configurações" e "Sair"), que leva para uma rota `/integrations` dedicada, com as três abas: Webhook, Grupo OLX e WhatsApp.

As abas de integrações são removidas de Configurações, deixando-a mais limpa.

### Estrutura proposta

```text
Sidebar (parte de baixo):
├── [Painel Agência] (só para super admins)
├── Integrações          ← NOVO  (/integrations)
│   └── Webhook | Grupo OLX | WhatsApp
├── Configurações        (/settings)
│   └── Perfil | Equipe | Notificações | Permissões | White Label
└── Sair
```

### Arquivos a modificar

**1. `src/App.tsx`**
- Adicionar nova rota `/integrations` apontando para um novo componente `<Integrations />`

**2. `src/pages/Integrations.tsx`** ← NOVO ARQUIVO
- Nova página com apenas as 3 abas: Webhook, Grupo OLX e WhatsApp
- Reutiliza os componentes já existentes: `WhatsAppIntegrationSettings`, `OlxIntegrationSettings` e o conteúdo atual da aba Webhook (que será extraído do `Settings.tsx` para um novo componente `WebhookSettings.tsx`)
- Lê o `?tab=` da URL para navegação direta (ex: `/integrations?tab=olx`)

**3. `src/components/WebhookSettings.tsx`** ← NOVO ARQUIVO
- Extrai o conteúdo da aba Webhook do `Settings.tsx` para um componente reutilizável
- Toda a lógica de URL, payload de teste e lista de imóveis vai para cá

**4. `src/components/AppSidebar.tsx`**
- Adicionar item "Integrações" com ícone `Plug` ou `Link2` na seção `bottomItems`, acima de "Configurações"
- Usar o mesmo estilo visual dos demais itens

**5. `src/components/BottomNav.tsx`** (navegação mobile)
- Verificar se precisa de ajuste para incluir o acesso a Integrações no mobile

**6. `src/pages/Settings.tsx`**
- Remover as abas `webhook`, `olx` e `whatsapp-integration` do `navItems`
- Remover os `case` correspondentes do `renderContent()`
- Remover imports que deixarem de ser usados (`OlxIntegrationSettings`, `WhatsAppIntegrationSettings`)
- Remover do tipo `TabValue` os três valores removidos

### Visual da nova página Integrações

```text
┌──────────────────────────────────────────┐
│  ⚡ Integrações                           │
│  Gerencie as conexões com portais e      │
│  plataformas externas                    │
│                                          │
│  [🔗 Webhook] [🏢 Grupo OLX] [💬 WhatsApp]│
│  ─────────────────────────────────────── │
│  (conteúdo da aba selecionada)           │
└──────────────────────────────────────────┘
```

### Sem quebras de compatibilidade

- Links diretos como `/settings?tab=webhook` deixarão de funcionar — mas como essa URL não é exposta ao usuário final em nenhum lugar do código (apenas navegação pela UI), não há impacto real
- Os componentes `WhatsAppIntegrationSettings` e `OlxIntegrationSettings` não mudam, apenas são movidos para uma nova página pai
