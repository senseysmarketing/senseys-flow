

## Mover Eventos Meta CAPI para Configuracoes de Leads

### Contexto

Os eventos Meta CAPI estao sendo disparados corretamente para o pixel de cada cliente (todos os ultimos 20 logs com status 200). As informacoes enviadas incluem email e telefone em hash SHA-256, meta_lead_id para matching, interesse do lead e origem.

A tela de configuracao de eventos Meta CAPI foi movida anteriormente para a pagina de Relatorios (`ReportsSettingsSheet`), mas o usuario deseja que ela fique acessivel diretamente nas configuracoes da pagina de Leads, seguindo o mesmo padrao de modal das demais opcoes.

### O que sera feito

**1. Adicionar opcao "Eventos Meta CAPI" no `LeadsSettingsSheet`**

- Adicionar um novo item no menu de configuracoes de leads com icone `Send` e descricao "Configure o disparo de eventos para otimizacao de campanhas"
- Ao clicar, abre um modal (Dialog) com o componente `MetaEventMappingManager`, igual ao padrao das outras opcoes (Status, Distribuicao, etc.)

**2. Remover da pagina de Relatorios (opcional)**

- Remover o `MetaEventMappingManager` do `ReportsSettingsSheet` para evitar duplicidade, ja que a configuracao passara a viver na tela de Leads

### Detalhes Tecnicos

**Arquivo: `src/components/leads/LeadsSettingsSheet.tsx`**

- Adicionar import do `Send` (lucide-react) - ja importado no arquivo
- Adicionar novo item no array `settingsItems`:
  ```
  { id: "meta-events", icon: Send, label: "Eventos Meta CAPI", description: "Configure o disparo de eventos para otimizacao de campanhas" }
  ```
- Adicionar entrada no `modalConfig`:
  ```
  "meta-events": { title: "Eventos Meta CAPI", description: "Configure eventos de conversao enviados ao Meta", maxWidth: "!max-w-5xl" }
  ```
- Adicionar case no `renderModalContent`:
  ```
  case "meta-events": return <MetaEventMappingManager />;
  ```
- Importar `MetaEventMappingManager` no topo do arquivo

**Arquivo: `src/components/reports/ReportsSettingsSheet.tsx`**

- Remover o conteudo de eventos Meta CAPI, simplificando ou removendo o sheet se nao houver mais opcoes

### Resultado

O usuario podera acessar a configuracao completa de eventos Meta CAPI (mapeamento de status para eventos, teste de conexao, logs recentes e estatisticas) diretamente pelo icone de engrenagem na pagina de Leads, sem precisar navegar para outra pagina.

