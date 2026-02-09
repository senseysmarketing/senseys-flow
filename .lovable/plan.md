
## Plano: Sistema de Motivo de Desqualificacao de Leads

### Visao Geral

Ao mover um lead para o status "Perdido" (posicao 7, ultimo status do sistema), um modal de confirmacao aparecera solicitando o motivo da desqualificacao. O usuario devera selecionar pelo menos um motivo e opcionalmente adicionar observacoes. Funciona no Kanban (drag-and-drop), na tabela (dropdown), e em acoes em massa (bulk actions).

### 1. Migracao SQL

Criar a tabela `lead_disqualification_reasons` com RLS baseada em `account_id`:

```sql
CREATE TABLE lead_disqualification_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  account_id uuid NOT NULL,
  reasons jsonb NOT NULL DEFAULT '[]',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lead_disqualification_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert reasons for their account"
  ON lead_disqualification_reasons FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can view reasons from their account"
  ON lead_disqualification_reasons FOR SELECT
  USING (account_id = get_user_account_id());
```

O campo `reasons` armazena um array JSON como:
```json
["sem_interesse", "nao_responde"]
```

### 2. Novo Componente: `DisqualifyLeadModal.tsx`

Modal com:
- Titulo: "Por que este lead foi desqualificado?"
- Lista de checkboxes com motivos pre-definidos:
  - Sem interesse real
  - Sem capacidade financeira
  - Fora do perfil de imoveis
  - Nao responde / Sem retorno
  - Dados invalidos (telefone/email)
  - Lead duplicado
  - Comprou com concorrente
  - Desistiu da compra/aluguel
- Campo de texto "Observacoes adicionais (opcional)"
- Botao "Confirmar" habilitado apenas com pelo menos 1 motivo selecionado
- Botao "Cancelar" que cancela a mudanca de status

Ao confirmar:
1. Salva o registro em `lead_disqualification_reasons`
2. Executa a mudanca de status do lead
3. Registra atividade na timeline (`disqualified`)

### 3. Modificacao em `Leads.tsx`

**`handleStatusChange`** (linha 565):
- Antes de executar a mudanca, verificar se o status destino e o "Perdido" (posicao 7 ou nome "Perdido")
- Se sim, abrir o `DisqualifyLeadModal` passando `leadId` e `statusId`
- O modal executa a mudanca apos confirmacao
- Se nao, manter comportamento atual

**`onDragEnd`** (linha 633):
- Mesmo tratamento: verificar se destino e "Perdido" antes de chamar `handleStatusChange`
- Armazenar `leadId` e `statusId` pendentes em estado para o modal usar

**Bulk actions** (`handleBulkStatusChange`):
- Quando o status destino for "Perdido", abrir o modal para cada lead ou usar o mesmo motivo para todos

### 4. Modificacao no `LeadDetailModal.tsx`

Quando o lead tiver status "Perdido":
- Buscar registro de `lead_disqualification_reasons` para o `lead_id`
- Exibir secao "Motivo da Desqualificacao" com badges dos motivos e observacoes

### 5. Modificacao no `LeadActivityTimeline.tsx`

Adicionar tipo `disqualified` no `activityConfig`:
```typescript
disqualified: { icon: XCircle, color: "text-red-500", label: "Lead desqualificado" }
```

### Arquivos

| Acao | Arquivo |
|------|---------|
| Criar | `src/components/leads/DisqualifyLeadModal.tsx` |
| Modificar | `src/pages/Leads.tsx` |
| Modificar | `src/components/LeadDetailModal.tsx` |
| Modificar | `src/components/LeadActivityTimeline.tsx` |
| Migracao | Nova tabela `lead_disqualification_reasons` |

### Resultado

- Modal obrigatorio ao desqualificar leads (Kanban, tabela, bulk)
- Historico de motivos registrado no banco
- Motivos visiveis no detalhe do lead
- Timeline registra a desqualificacao com os motivos
- Dados disponiveis para futura analise gerencial
