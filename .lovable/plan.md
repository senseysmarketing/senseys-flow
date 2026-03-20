

## Corrigir Redundância no Histórico de Atividades ao Criar Lead

### Problema

Quando um lead chega (ex: via Facebook), 3 atividades são criadas simultaneamente:

1. **Trigger do banco (INSERT)** → "Lead criado por Sistema"
2. **meta-webhook (manual)** → "Lead via Facebook (campanha) - Frio"
3. **apply-distribution-rules (manual)** → "Lead atribuído automaticamente a X via regra Y"

Os itens 1 e 2 são redundantes — ambos registram a criação do lead. A solução é unificar em uma única entrada.

### Solução

#### 1. Melhorar o trigger `log_lead_activity()` no INSERT

Alterar a descrição do INSERT no trigger para incluir informações de origem e temperatura do lead, gerando algo como:

`"Lead via Facebook - Frio"` (quando origem existe)  
`"Lead criado por João"` (quando criado manualmente por um usuário logado)

Lógica: se `NEW.origem IS NOT NULL`, usar origem + temperatura na descrição. Caso contrário, manter "Lead criado por {user_name}".

**Migração SQL**: `CREATE OR REPLACE FUNCTION public.log_lead_activity()` — alterar apenas o bloco `IF TG_OP = 'INSERT'`.

#### 2. Remover insert manual do `meta-webhook/index.ts`

Remover a linha 251 que insere manualmente a atividade "created". O trigger já cuidará disso com as informações de origem.

#### 3. Manter o "assigned" do `apply-distribution-rules`

Este não é redundante — registra a atribuição ao corretor, que é uma ação separada da criação. Manter como está.

### Resultado Final

Apenas 2 entradas no histórico ao criar um lead com distribuição:
- "Lead via Facebook - Frio" (trigger)
- "Lead atribuído automaticamente a Gabriel via regra X" (distribution)

### Arquivos Modificados

| Arquivo | Ação |
|---------|------|
| Nova migração SQL | Atualizar função `log_lead_activity()` |
| `supabase/functions/meta-webhook/index.ts` | Remover insert manual (linha 251) |

