

## Plano: Configuracoes de Leads com Modais Inline

### Problema Atual

Ao clicar em uma opcao no menu de configuracoes de leads (engrenagem), o sistema redireciona para `/settings?tab=X` usando `window.location.href`, tirando o usuario da pagina de Leads. A pagina de Settings nem reconhece mais essas tabs (foram removidas na simplificacao), entao o redirecionamento nao leva a lugar algum.

### Solucao

Transformar o `LeadsSettingsSheet` para que cada opcao abra um **Dialog (modal)** com o componente de configuracao correspondente, mantendo o usuario na pagina de Leads.

### Fluxo

1. Usuario clica na engrenagem -> abre o Sheet com lista de opcoes
2. Usuario clica em uma opcao (ex: "Qualificacao Automatica") -> fecha o Sheet e abre um Dialog com o conteudo correspondente
3. Usuario configura e fecha o Dialog -> volta para a pagina de Leads normalmente

### Arquivo a Modificar

**`src/components/leads/LeadsSettingsSheet.tsx`**

### Mudancas

1. **Adicionar estado para modal ativo**: `activeModal` com o tipo `SettingsTab | null`
2. **Remover o `window.location.href`**: substituir por `setActiveModal(tab)` que fecha o Sheet e abre o Dialog
3. **Renderizar Dialogs condicionais** com os componentes existentes:
   - `status` -> Conteudo de gerenciamento de status (reaproveitando a logica de drag-and-drop de status do Settings.tsx, simplificado como um componente dedicado ou inline)
   - `distribution` -> `<DistributionRulesManager />`
   - `qualification` -> `<MetaFormScoringManager />`
   - `followup` -> `<FollowUpSettings />`
   - `import` -> `<DataImporter />`
4. **Cada Dialog** tera titulo e descricao adequados, com `max-w-3xl` para componentes que precisam de mais espaco

### Mapeamento de Modais

| Opcao | Componente | Largura |
|-------|-----------|---------|
| Status dos Leads | Conteudo de status inline (drag-and-drop, cores) | max-w-2xl |
| Regras de Distribuicao | `DistributionRulesManager` | max-w-3xl |
| Qualificacao Automatica | `MetaFormScoringManager` | max-w-4xl |
| Follow-up Automatico | `FollowUpSettings` | max-w-2xl |
| Importar Leads | `DataImporter` | max-w-4xl |

### Detalhes Tecnicos

- Para o modal de **Status**, sera necessario extrair a logica de gerenciamento de status do `Settings.tsx` para um componente separado (`LeadStatusManager.tsx`) ou renderizar inline com fetch proprio
- Os demais componentes (`DistributionRulesManager`, `MetaFormScoringManager`, `FollowUpSettings`, `DataImporter`) ja sao independentes e podem ser usados diretamente dentro do Dialog
- O Dialog usara `!max-w-3xl` ou `!max-w-4xl` conforme necessidade, com `max-h-[85vh] overflow-y-auto` para scroll interno

### Arquivos

| Acao | Arquivo |
|------|---------|
| Modificar | `src/components/leads/LeadsSettingsSheet.tsx` |
| Criar | `src/components/leads/LeadStatusManager.tsx` (extraido do Settings.tsx) |

### Resultado

- Configuracoes de leads abrem em modais sem sair da pagina
- Cada modal mostra o componente de configuracao correspondente
- Experiencia fluida e contextual conforme a arquitetura do sistema

