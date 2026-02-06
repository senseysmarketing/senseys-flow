
## Plano de Correcao do Dashboard Mobile

### Problemas Identificados

Analisando a screenshot, os principais problemas sao:

1. **QuickLeadActions (Leads Prioritarios)**: Os badges de temperatura (`Quente`) estao sendo cortados no lado direito porque os botoes de acao (WhatsApp, telefone) e o badge competem pelo espaco horizontal
2. **BrokerRanking**: Este componente tem uma estrutura de grid complexa (`grid-cols-6`) que nao e responsiva para mobile - esta sendo incluido na Dashboard mas e muito denso para telas pequenas
3. **Espacamento geral**: Os cards precisam de mais espaco inferior para evitar que o BottomNav sobreponha conteudo

### Estrutura Atual do QuickLeadActions

```text
+------------------------------------------------------------------+
| [Avatar] | [Nome........] [Badge Quente] | [WhatsApp] [Telefone] |
|          | 31 dias sem contato           |                       |
+------------------------------------------------------------------+
                                       ^
                               Muito apertado - badge cortado
```

### Estrutura Proposta para Mobile

```text
+----------------------------------+
| [Avatar] [Nome]                  |
|          31 dias sem... [Quente] |
|                                  |
| [WhatsApp icon] [Telefone icon]  |
+----------------------------------+
```

### Mudancas Necessarias

#### 1. Arquivo: `src/components/dashboard/QuickLeadActions.tsx`

**Problema**: O layout usa `flex items-center` com todos os elementos na mesma linha, causando overflow.

**Solucao**: Detectar mobile e ajustar o layout para ser vertical quando necessario:

- Adicionar `useIsMobile` hook
- No mobile, reorganizar o card para que nome/badge fiquem em uma linha e botoes de acao em outra
- Usar `flex-wrap` ou layout de coluna para evitar corte

#### 2. Arquivo: `src/pages/Dashboard.tsx`

**Problema**: O `BrokerRanking` e muito denso para mobile.

**Solucao**: 
- No mobile, mostrar apenas uma versao compacta do ranking (top 3 corretores)
- Esconder graficos complexos no mobile
- Aumentar o padding inferior para `pb-24` para evitar sobreposicao com BottomNav

#### 3. Arquivo: `src/components/BrokerRanking.tsx`

**Problema**: O grid de 6 colunas (`grid-cols-6`) nao e responsivo.

**Solucao**:
- Criar uma versao compacta para mobile que mostra apenas informacoes essenciais
- Usar `useIsMobile` para alternar entre layouts

### Detalhes Tecnicos das Mudancas

#### QuickLeadActions.tsx - Mudancas no layout do card (linhas 140-180)

```typescript
// Adicionar useIsMobile
import { useIsMobile } from "@/hooks/use-mobile";

// Dentro do componente
const isMobile = useIsMobile();

// Modificar o layout do card para:
<div className={cn(
  "p-3 rounded-lg transition-all cursor-pointer hover:shadow-md",
  urgencyStyles[lead.urgency].bg,
  isMobile && "flex-col gap-2"
)}>
  <div className="flex items-center gap-3">
    <AvatarFallbackColored name={lead.name} size="sm" />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <h4 className="font-medium text-sm truncate max-w-[140px]">{lead.name}</h4>
        <TemperatureBadge temperature={lead.temperature} size="sm" />
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">...</span>
      </div>
    </div>
  </div>
  
  {/* Botoes de acao em linha separada no mobile */}
  <div className={cn(
    "flex items-center gap-2",
    isMobile && "justify-end"
  )}>
    <WhatsAppButton ... />
    <Button ... />
  </div>
</div>
```

#### Dashboard.tsx - Padding inferior e condicional do ranking

```typescript
// Linha 189-190 - Adicionar padding inferior adequado
<div className="space-y-6 sm:space-y-8 pb-24">

// Linha 352-355 - Condicionar BrokerRanking para desktop ou versao simples
{!isMobile && <BrokerRanking />}
{isMobile && <BrokerRankingCompact />} // ou apenas esconder no mobile
```

#### BrokerRanking.tsx - Versao responsiva

Para o BrokerRanking, a solucao mais limpa e criar uma prop `compact` que mostra apenas top 3 corretores em formato simples no mobile, sem graficos e sem a tabela densa.

### Resumo das Alteracoes por Arquivo

| Arquivo | Tipo de Mudanca |
|---------|-----------------|
| `src/components/dashboard/QuickLeadActions.tsx` | Layout responsivo para cards de lead |
| `src/pages/Dashboard.tsx` | Adicionar useIsMobile, padding inferior, e condicionar BrokerRanking |
| `src/components/BrokerRanking.tsx` | Adicionar prop compact e layout mobile simplificado |

### Impacto

- **Risco**: Baixo - mudancas visuais isoladas ao mobile
- **Tempo estimado**: 15-20 minutos
- **Beneficio**: Dashboard completamente funcional no mobile sem cortes ou overflow
