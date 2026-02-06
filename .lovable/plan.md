
# Redesign Completo do Senseys CRM

## Visão Geral

Este plano propõe uma reestruturação completa do design, layout e experiência do usuário do Senseys CRM, focando em:

1. **Dashboard Inteligente** com insights e recomendações AI-powered
2. **Configurações Contextuais** distribuídas por página relevante
3. **Visualização Unificada de Dados** com métricas claras e acionáveis
4. **Centro de Comando de Leads** mais prático para atendimento rápido
5. **Painel de Imóveis** com integração de métricas do Meta

---

## 1. Dashboard Inteligente (Nova Versão)

### Estrutura
```text
┌─────────────────────────────────────────────────────────────────┐
│  HERO: Resumo do Dia + Alertas Prioritários                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐│
│  │ Leads Hoje  │ │ Hot Leads   │ │ Follow-ups  │ │ Investimento│
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  INSIGHTS & RECOMENDAÇÕES AI                                    │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ 💡 "3 leads quentes sem contato há 2 dias - Priorize!"      ││
│  │ 📈 "CPL do imóvel X está 40% acima da média - Otimize"      ││
│  │ 🔥 "Campanha Y gerou 5 leads hoje - Seu melhor dia!"        ││
│  └──────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────┐  ┌────────────────────────────────┐ │
│  │ LEADS QUE PRECISAM     │  │ PERFORMANCE RÁPIDA             │ │
│  │ DE ATENÇÃO             │  │ • Funil de Conversão           │ │
│  │ • Leads urgentes       │  │ • Gráfico de evolução          │ │
│  │ • WhatsApp direto      │  │ • Top campanhas                │ │
│  └────────────────────────┘  └────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │ Ranking      │ │ Próximos     │ │ Imóveis em Destaque      │ │
│  │ Corretores   │ │ Compromissos │ │ (Mais leads, maior ROI)  │ │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Novos Componentes

| Componente | Descrição |
|------------|-----------|
| `InsightsCard` | Cards com recomendações inteligentes baseadas em dados |
| `QuickActionLeads` | Lista de leads urgentes com botão WhatsApp inline |
| `MiniConversionFunnel` | Funil visual compacto |
| `PropertyHighlights` | Top 3 imóveis por performance |
| `DailyGoals` | Metas diárias e progresso |

### Insights Automáticos
- Leads quentes sem contato há X dias
- Campanhas com CPL acima da média
- Imóveis com muitos leads e baixa conversão
- Corretores com melhor performance da semana
- Alertas de follow-up pendentes

---

## 2. Página de Leads Redesenhada

### Nova Estrutura
```text
┌────────────────────────────────────────────────────────────────┐
│ HEADER: Título + Busca + Filtros Rápidos + Toggle View + ⚙️   │
├────────────────────────────────────────────────────────────────┤
│ MINI-STATS: Total | Quentes | Mornos | Frios | Sem Corretor   │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ [KANBAN VIEW]          ou          [DATABASE VIEW]              │
│                                                                 │
│ Colunas com scroll                 Tabela com paginação         │
│ interno por status                 e seleção em massa           │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Configurações de Leads (Botão ⚙️ no Header)
Dropdown ou Sheet lateral com:
- Gerenciar Status
- Regras de Distribuição
- Regras de Qualificação
- Importar Leads
- Templates WhatsApp

### Melhorias de Atendimento Rápido
- Botão WhatsApp visível em cada card
- Ação de "Marcar como Contatado" com 1 clique
- Preview de informações ao hover
- Indicador visual de dias sem contato

---

## 3. Página de Imóveis Redesenhada

### Nova Estrutura
```text
┌────────────────────────────────────────────────────────────────┐
│ HEADER: Título + Busca + Filtros + Novo Imóvel + ⚙️            │
├────────────────────────────────────────────────────────────────┤
│ KPIs: Total | Disponíveis | Reservados | Investimento Total    │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ GRID/LIST VIEW                                                  │
│                                                                 │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                         │
│ │ Imóvel 1 │ │ Imóvel 2 │ │ Imóvel 3 │                         │
│ │ 15 leads │ │ 8 leads  │ │ 22 leads │                         │
│ │ R$ X CPL │ │ R$ Y CPL │ │ R$ Z CPL │                         │
│ │ 🔥 3 hot │ │ 🔥 1 hot │ │ 🔥 5 hot │                         │
│ └──────────┘ └──────────┘ └──────────┘                         │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Cards de Imóvel Aprimorados
- Indicador de leads (total + quentes)
- CPL calculado automaticamente
- Badge de status com cor
- Investimento do período
- Ação rápida: Ver Leads do Imóvel

### Modal de Detalhes Expandido
- Aba de Performance (CPL, ROI, evolução)
- Aba de Leads vinculados
- Aba de Histórico de campanhas
- Comparativo com média geral

---

## 4. Relatórios Redesenhados

### Nova Estrutura com Navegação Clara
```text
┌────────────────────────────────────────────────────────────────┐
│ HEADER: Período Selecionado | Sync Meta | Exportar             │
├────────────────────────────────────────────────────────────────┤
│ GLOBAL KPIs (sempre visíveis)                                  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│
│ │Investido │ │ Leads    │ │ Quentes  │ │ CPL Médio│ │Conversão│
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘│
├────────────────────────────────────────────────────────────────┤
│ TABS: [Visão Geral] [Campanhas] [Imóveis] [Corretores] [Funil] │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ CONTEÚDO DA TAB ATIVA                                           │
│                                                                 │
│ Gráficos interativos + Tabelas detalhadas                       │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Nova Aba: Visão Geral
- Gráfico de evolução diária (leads vs investimento)
- Pie chart de temperatura
- Top 5 campanhas
- Top 5 imóveis
- Comparativo com período anterior

### Melhorias nas Abas Existentes
- **Campanhas**: Tabela ordenável com CPL, leads, status
- **Imóveis**: CPL por imóvel com drill-down
- **Corretores**: Ranking com métricas expandidas
- **Funil**: Visualização do fluxo de conversão

---

## 5. Configurações Distribuídas por Contexto

### Reorganização
```text
ANTES (Settings.tsx centralizado):
├── Perfil
├── Equipe
├── Notificações
├── Status dos Leads     ──→ Mover para Leads
├── Follow-up            ──→ Mover para Leads
├── Distribuição         ──→ Mover para Leads
├── Qualificação         ──→ Mover para Leads
├── WhatsApp             ──→ Mover para Leads (comunicação)
├── Webhook              ──→ Manter (Avançado)
├── Meta CAPI            ──→ Mover para Relatórios/Meta
├── Permissões           ──→ Manter (Avançado)
├── White Label          ──→ Manter (Avançado)
├── Importação           ──→ Mover para Leads

DEPOIS:
/settings (simplificado):
├── Perfil
├── Equipe
├── Notificações
├── Avançado (Webhook, Permissões, White Label)

/leads (contextual - botão ⚙️):
├── Status dos Leads
├── Regras de Distribuição
├── Regras de Qualificação
├── Follow-up Automático
├── Templates WhatsApp
├── Importar Leads

/reports (contextual - botão ⚙️):
├── Configuração Meta Ads
├── Mapeamento de Eventos
```

---

## 6. Componentes de UI Novos

### InsightsPanel
```typescript
interface Insight {
  type: 'warning' | 'success' | 'info' | 'action';
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}
```

### QuickLeadAction
Card compacto de lead com:
- Nome + Temperatura
- Dias sem contato
- Botão WhatsApp
- Botão "Contatado"

### ContextualSettings
Sheet/Dialog que aparece ao clicar em ⚙️ em cada página

### MiniMetricCard
Versão compacta do StatCard para métricas inline

### ComparisonBadge
Badge que mostra comparação % com período anterior

---

## 7. Sidebar Simplificada

### Nova Estrutura
```text
┌────────────────┐
│ [Logo]         │
├────────────────┤
│ 🏠 Dashboard   │
│ 👥 Leads       │
│ 🏢 Imóveis     │
│ 📊 Relatórios  │
│ 📅 Agenda      │
├────────────────┤
│ ⚙️ Configurações│
│ 🚪 Sair        │
└────────────────┘
```
- Menos itens, mais foco
- Cada página tem suas próprias configurações contextuais

---

## 8. Mobile Experience Aprimorada

### Dashboard Mobile
- Cards empilhados verticalmente
- Insights em carrossel
- Ações rápidas em grid 2x2
- Bottom sheet para detalhes

### Leads Mobile
- Card expandido com ações
- Swipe para WhatsApp
- Filtros em bottom sheet
- FAB para novo lead

### BottomNav (mantido)
- Home | Leads | Imóveis | Relatórios | Config

---

## Arquivos a Criar/Modificar

### Novos Componentes
| Arquivo | Descrição |
|---------|-----------|
| `src/components/dashboard/InsightsPanel.tsx` | Painel de insights inteligentes |
| `src/components/dashboard/QuickLeadActions.tsx` | Leads que precisam atenção |
| `src/components/dashboard/MiniConversionFunnel.tsx` | Funil compacto |
| `src/components/dashboard/PropertyHighlights.tsx` | Imóveis em destaque |
| `src/components/leads/LeadsSettingsSheet.tsx` | Configurações contextuais |
| `src/components/leads/QuickLeadCard.tsx` | Card de lead com ações rápidas |
| `src/components/properties/PropertyMetricsCard.tsx` | Card com métricas |
| `src/components/reports/ReportsOverviewTab.tsx` | Nova aba visão geral |
| `src/components/ui/comparison-badge.tsx` | Badge de comparação % |
| `src/components/ui/mini-metric-card.tsx` | Métrica compacta |

### Páginas Modificadas
| Arquivo | Mudanças |
|---------|----------|
| `src/pages/Dashboard.tsx` | Redesign completo com insights |
| `src/pages/Leads.tsx` | Header com configurações contextuais |
| `src/pages/Properties.tsx` | Cards com métricas, KPIs no topo |
| `src/pages/Reports.tsx` | Nova aba Visão Geral, layout limpo |
| `src/pages/Settings.tsx` | Simplificado (apenas Perfil/Equipe/Avançado) |

### Hooks Novos
| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/use-insights.tsx` | Gera insights baseados nos dados |
| `src/hooks/use-lead-priorities.tsx` | Identifica leads que precisam atenção |

---

## Fases de Implementação

### Fase 1: Foundation
1. Criar componentes base de UI (comparison-badge, mini-metric-card)
2. Criar hook `use-insights`
3. Criar hook `use-lead-priorities`

### Fase 2: Dashboard
1. Redesign completo do Dashboard
2. Implementar InsightsPanel
3. Implementar QuickLeadActions
4. Implementar MiniConversionFunnel

### Fase 3: Leads
1. Adicionar header com configurações contextuais
2. Criar LeadsSettingsSheet
3. Melhorar cards com ações rápidas
4. Adicionar mini-stats no topo

### Fase 4: Properties
1. Adicionar KPIs no topo
2. Melhorar cards com métricas
3. Integrar dados do Meta nos cards

### Fase 5: Reports
1. Criar aba Visão Geral
2. Melhorar layout das tabs
3. Adicionar comparação com período anterior

### Fase 6: Settings
1. Simplificar Settings.tsx
2. Mover configurações para páginas contextuais

---

## Resultado Esperado

- **Dashboard**: Centro de comando com insights acionáveis
- **Leads**: Atendimento rápido com 1-2 cliques para WhatsApp
- **Imóveis**: Métricas claras de performance por imóvel
- **Relatórios**: Visão unificada de investimento x retorno
- **Configurações**: Organizadas por contexto, fáceis de encontrar
- **Mobile**: Experiência otimizada para atendimento em campo
