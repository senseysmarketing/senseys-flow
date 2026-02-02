
## Plano: Corrigir Acesso à Integração Meta para Todos os Usuários da Agência

### Problema Identificado

O usuário "Leo Henry" está na conta da agência Senseys e deveria ter acesso ao painel de integração Meta, mas as edge functions bloqueiam seu acesso porque verificam a tabela `super_admins` diretamente, em vez de usar a função `is_super_admin()` do banco de dados.

| Usuário | Account ID | Está em `super_admins`? | `is_super_admin()` retorna? |
|---------|------------|------------------------|----------------------------|
| Gabriel Facioli | Senseys | Sim | `true` |
| Leo Henry | Senseys | Não | `true` (via account_id) |
| João Paulo | Senseys | Não | `true` (via account_id) |

A função `is_super_admin()` do banco inclui corretamente todos os usuários da conta Senseys:
```sql
SELECT EXISTS (SELECT 1 FROM super_admins WHERE user_id = _user_id)
   OR EXISTS (
     SELECT 1 FROM profiles 
     WHERE user_id = _user_id 
     AND account_id = '05f41011-8143-4a71-a3ca-8f42f043ab8c' -- Senseys
   )
```

---

### Edge Functions Afetadas

| Edge Function | Status | Problema |
|---------------|--------|----------|
| `meta-accounts` | Corrigida | Já usa RPC `is_super_admin()` |
| `meta-oauth` | **Incorreta** | Verifica tabela `super_admins` diretamente |
| `meta-insights` | **Incorreta** | Verifica tabela `super_admins` diretamente |

---

### Solução

Atualizar as duas edge functions restantes para usar `supabase.rpc('is_super_admin', { _user_id: user.id })` em vez de query direta na tabela.

---

### Arquivo 1: `supabase/functions/meta-oauth/index.ts`

**Mudança 1 - Callback OAuth (linhas 86-106):**

```text
DE (verificação direta):
const { data: superAdminCheck } = await supabase
  .from('super_admins')
  .select('id')
  .eq('user_id', state)
  .single();

if (!superAdminCheck) { ... }
```

```text
PARA (usando RPC):
const { data: isSuperAdmin } = await supabase
  .rpc('is_super_admin', { _user_id: state });

if (!isSuperAdmin) { ... }
```

**Mudança 2 - Outras ações (linhas 247-258):**

```text
DE:
const { data: superAdmin } = await supabase
  .from('super_admins')
  .select('id')
  .eq('user_id', user.id)
  .single();

if (!superAdmin) { ... }
```

```text
PARA:
const { data: isSuperAdmin, error: saError } = await supabase
  .rpc('is_super_admin', { _user_id: user.id });

if (saError || !isSuperAdmin) { ... }
```

---

### Arquivo 2: `supabase/functions/meta-insights/index.ts`

**Mudança 1 - Ação "sync" (linhas 67-85):**

```text
DE:
const { data: superAdmin } = await supabase
  .from('super_admins')
  .select('id')
  .eq('user_id', user.id)
  .single();

if (!superAdmin && targetAccountId !== userProfile?.account_id) { ... }
```

```text
PARA:
const { data: isSuperAdmin } = await supabase
  .rpc('is_super_admin', { _user_id: user.id });

if (!isSuperAdmin && targetAccountId !== userProfile?.account_id) { ... }
```

**Mudança 2 - Ação "sync-all" (linhas 365-375):**

Aplicar a mesma substituição para a verificação na ação `sync-all`.

---

### Resumo das Alterações

| Arquivo | Linhas | Alteração |
|---------|--------|-----------|
| `meta-oauth/index.ts` | ~86-106 | Substituir query `super_admins` por RPC |
| `meta-oauth/index.ts` | ~247-258 | Substituir query `super_admins` por RPC |
| `meta-insights/index.ts` | ~67-85 | Substituir query `super_admins` por RPC |
| `meta-insights/index.ts` | ~365-375 | Substituir query `super_admins` por RPC |

---

### Resultado Esperado

Após as correções:
- Leo Henry poderá acessar a aba "Integração Meta" normalmente
- Todos os 5 usuários da conta Senseys terão acesso igual às funcionalidades Meta
- As verificações de permissão serão consistentes entre frontend e backend
