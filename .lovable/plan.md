

## Deteccao de Leads Duplicados e Historico

### Objetivo

Detectar automaticamente quando um lead com o mesmo telefone (ou email) ja existe na base, sem bloquear a entrada. O lead novo e criado normalmente, mas recebe um aviso visual e um link para o historico do lead anterior.

### Como Vai Funcionar

1. **Na criacao do lead** (manual, webhook, Meta): o sistema verifica se ja existe um lead com o mesmo telefone ou email na mesma conta
2. **Se encontrar duplicata**: marca o novo lead com uma flag e armazena referencia ao lead anterior
3. **No Kanban e na tabela**: exibe um badge de alerta "Lead Recorrente" no card/linha
4. **No modal de detalhes**: exibe um alerta com o historico do lead anterior (status, data de entrada, corretor atribuido, temperatura, observacoes)

### Pontos de Deteccao

A verificacao acontecera em 3 pontos de entrada de leads:

- **Manual** (`src/pages/Leads.tsx` - `handleCreateLead`): antes de inserir, busca duplicata e adiciona metadados
- **Webhook** (`supabase/functions/webhook-leads/index.ts`): antes de inserir, busca duplicata
- **Meta** (`supabase/functions/meta-webhook/index.ts`): antes de inserir, busca duplicata

### Mudancas no Banco de Dados

Adicionar 2 colunas na tabela `leads`:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `is_duplicate` | boolean | Default false. True quando detectado como recorrente |
| `duplicate_of_lead_id` | uuid (nullable) | Referencia ao lead anterior encontrado |

### Logica de Deteccao

```text
1. Normalizar telefone do novo lead (remover formatacao, manter so digitos)
2. Buscar na tabela leads (mesmo account_id) por:
   - Telefone com sufixo igual (ultimos 9 digitos) -> match por telefone
   - OU email identico (se ambos tiverem email) -> match por email
3. Se encontrar, pegar o lead mais recente como referencia
4. Marcar: is_duplicate = true, duplicate_of_lead_id = id_do_lead_encontrado
```

A busca usa os ultimos 9 digitos do telefone para cobrir variacoes de formatacao (com/sem DDD, com/sem +55, etc.).

### Mudancas Visuais

**Card do Kanban** (`LeadKanbanCard.tsx`):
- Badge discreto "Recorrente" com icone de alerta quando `is_duplicate = true`

**Tabela de Leads** (`LeadsTable.tsx`):
- Icone de alerta ao lado do nome quando duplicado

**Modal de Detalhes** (`LeadDetailModal.tsx`):
- Alerta no topo: "Este lead ja entrou anteriormente"
- Secao "Historico Anterior" mostrando dados do lead referenciado:
  - Nome, telefone, email
  - Status e temperatura que tinha
  - Data de entrada e ultima atualizacao
  - Corretor atribuido
  - Observacoes
  - Botao para abrir os detalhes do lead anterior

### Arquivos a Modificar

1. **Nova migracao SQL** - adicionar colunas `is_duplicate` e `duplicate_of_lead_id`
2. **`src/pages/Leads.tsx`** - deteccao na criacao manual
3. **`supabase/functions/webhook-leads/index.ts`** - deteccao no webhook
4. **`supabase/functions/meta-webhook/index.ts`** - deteccao no Meta
5. **`src/components/LeadKanbanCard.tsx`** - badge visual de recorrente
6. **`src/components/leads/LeadsTable.tsx`** - indicador visual na tabela
7. **`src/components/LeadDetailModal.tsx`** - alerta + secao de historico anterior
8. **`src/integrations/supabase/types.ts`** - atualizar tipos com novas colunas

### Fluxo Completo

```text
Lead entra (qualquer canal)
    |
    v
Normaliza telefone -> busca por sufixo (9 digitos)
    |
    v
Encontrou lead anterior?
    |-- Sim --> Cria lead com is_duplicate=true + duplicate_of_lead_id
    |-- Nao --> Cria lead normalmente (is_duplicate=false)
    |
    v
Kanban/Tabela: mostra badge "Recorrente" se is_duplicate
    |
    v
Modal de detalhes: mostra alerta + dados do lead anterior
```

