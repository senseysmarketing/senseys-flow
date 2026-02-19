
## Redesign das Automações WhatsApp: Saudação com Regras Condicionais + Follow-up Separado

### Visão Geral da Proposta

A ideia é excelente e muito bem pensada. A tela atual mistura saudação e follow-up em um único card sem muita distinção visual. A proposta é:

1. **Separar visualmente** Saudação e Follow-up em seções independentes e distintas
2. **Adicionar "Grupo OLX"** como nova fonte de leads nas opções de envio (já habilitado por padrão)
3. **Sistema de Regras Condicionais de Saudação** — além de uma mensagem padrão, permitir regras específicas com prioridade, ex: "para imóvel X, envie template Y"
4. **Configuração por imóvel** diretamente no modal de detalhes do imóvel

---

### Regras Condicionais de Saudação — Como Funcionarão

A lógica será em camadas (prioridade):

```
[Verificar Regras na Ordem]
  ↓
  1. Regra por Imóvel específico (property_id = X) → usa template da regra
  2. Regra por Faixa de Valor (ex: R$500k–R$1M) → usa template da regra
  3. Regra por Tipo de Imóvel (apartamento, casa, etc.) → usa template da regra
  4. Regra por Tipo de Transação (Venda / Aluguel) → usa template da regra
  5. Regra por Campanha/Formulário (campo campanha = X) → usa template da regra
  6. Regra por Origem do Lead (Meta Ads, OLX, Webhook, Manual) → usa template
  ↓
  Nenhuma regra casou → usa template PADRÃO
```

---

### Banco de Dados — Nova Tabela

Será necessária **1 nova migration** para criar `whatsapp_greeting_rules`:

```sql
CREATE TABLE whatsapp_greeting_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,  -- menor número = maior prioridade
  is_active BOOLEAN DEFAULT true,
  template_id UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  delay_seconds INTEGER DEFAULT 60,
  -- Condições (qualquer um que não seja null é avaliado)
  condition_type TEXT NOT NULL,  -- 'property', 'price_range', 'property_type', 'transaction_type', 'campaign', 'origin'
  condition_property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  condition_price_min NUMERIC,
  condition_price_max NUMERIC,
  condition_property_type TEXT,    -- 'apartment', 'house', 'land', 'commercial', etc.
  condition_transaction_type TEXT, -- 'sale', 'rent'
  condition_campaign TEXT,         -- valor do campo campanha/origem
  condition_origin TEXT,           -- 'manual', 'meta', 'webhook', 'olx'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

A `whatsapp_automation_rules` (regra padrão) continua existindo como o "fallback" quando nenhuma regra condicional casa.

---

### Atualização no `trigger_sources` — adicionar OLX

A migration também atualiza a coluna `trigger_sources` na `whatsapp_automation_rules` adicionando o campo `olx: true` ao default:

```sql
ALTER TABLE whatsapp_automation_rules 
ALTER COLUMN trigger_sources SET DEFAULT 
  '{"manual": true, "meta": true, "webhook": true, "olx": true}'::jsonb;
```

E atualiza registros existentes para incluir `olx: true`.

---

### Frontend — Componente Redesenhado

O `WhatsAppIntegrationSettings.tsx` será dividido em sub-seções visuais claras:

**Seção 1: Conexão** (já existe, mantida)

**Seção 2: Saudação Automática** — Card separado e expandido:
- Toggle de ativar/desativar global
- **Template e Delay padrão** (fallback)
- **Fontes** de leads: Manual | Meta Ads | Webhook | **Grupo OLX** (novo, ativo por padrão)
- **Lista de Regras Condicionais** (nova):
  - Badge de prioridade + tipo da condição + template vinculado
  - Botão "Adicionar Regra" → abre modal/drawer de criação
  - Cada regra tem toggle de ativo/inativo e botão remover
  - Ordenação por prioridade (drag não necessário por ora, apenas número)

**Seção 3: Follow-up Automático** — Card completamente separado (como aparece na imagem de referência, mantendo o design atual mas mais limpo)

---

### Modal de Criação de Regra Condicional

Um `Dialog` com as seguintes opções de `condition_type`:

| Tipo | Campo exibido |
|---|---|
| `property` | Select de imóvel (busca por título/referência) |
| `price_range` | Inputs de valor mínimo e máximo |
| `property_type` | Select: Apartamento, Casa, Terreno, Comercial, Rural |
| `transaction_type` | Select: Venda, Aluguel |
| `campaign` | Input de texto livre (match parcial) |
| `origin` | Select: Cadastro Manual, Meta Ads, Webhook, Grupo OLX |

Além disso: nome da regra, template, delay e prioridade.

---

### Configuração por Imóvel no Modal de Detalhes

No `PropertyDetailModal.tsx`, será adicionada uma nova seção "Saudação WhatsApp" com:
- Badge mostrando se existe uma regra ativa para este imóvel
- Botão "Configurar saudação específica" que abre o modal de criação de regra já preenchido com `condition_type = 'property'` e `condition_property_id = property.id`
- Se existir uma regra para este imóvel: mostra o template vinculado e opção de editar/remover

---

### Atualização na Edge Function `process-whatsapp-queue`

A lógica de seleção de template precisará ser atualizada para verificar regras condicionais antes de usar o template padrão. Isso será feito dentro da function `notify-new-lead` ou `webhook-leads` que enfileira a mensagem — ao criar a entrada na `whatsapp_message_queue`, já se passa o `template_id` correto após avaliar as regras.

---

### Arquivos a criar/modificar

1. **Nova migration** — cria `whatsapp_greeting_rules`, adiciona `olx` ao `trigger_sources`
2. **`src/components/whatsapp/WhatsAppIntegrationSettings.tsx`** — redesign completo da seção de automações
3. **`src/components/whatsapp/GreetingRuleModal.tsx`** ← NOVO — modal para criar/editar regras condicionais
4. **`src/components/PropertyDetailModal.tsx`** — adicionar seção de configuração de saudação do imóvel
5. **`supabase/functions/notify-new-lead/index.ts`** — atualizar lógica de seleção de template para avaliar regras condicionais

---

### Escopo desta entrega vs. futuro

**Incluso agora:**
- Separação visual Saudação / Follow-up
- Grupo OLX como fonte (checkbox nas fontes)
- Sistema de regras condicionais (tabela + UI + criação/edição/remoção)
- Configuração por imóvel no modal de propriedade
- Execução real das regras na edge function

**Para futuro:**
- Drag-and-drop para reordenar prioridade das regras
- Estatísticas por regra (quantos leads atingidos)
- Testes A/B entre templates
