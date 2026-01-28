
## Plano: Permitir que Todos os Usuários da Agência Gerenciem Integração Meta

**Problema identificado:**

A edge function `meta-accounts` verifica permissões de forma diferente do restante do sistema:

| Componente | Lógica de verificação |
|------------|----------------------|
| `is_super_admin()` (DB) | Tabela `super_admins` **OU** usuários da conta Senseys |
| `use-super-admin` (frontend) | Usa `is_super_admin()` via RPC - funciona |
| **`meta-accounts` (edge function)** | Apenas tabela `super_admins` - **problema aqui** |

Por isso, o frontend permite que usuários da agência acessem o painel (correto), mas quando tentam fazer operações na integração Meta, a edge function bloqueia (incorreto).

---

## Solução Proposta

Atualizar a edge function `supabase/functions/meta-accounts/index.ts` para usar a mesma lógica de verificação que a função `is_super_admin()` do banco de dados.

### Mudanças Técnicas

**Arquivo:** `supabase/functions/meta-accounts/index.ts`

Substituir a verificação atual (linhas 39-51):
```javascript
// Verificação ATUAL (incompleta)
const { data: superAdmin } = await supabase
  .from('super_admins')
  .select('id')
  .eq('user_id', user.id)
  .single();

if (!superAdmin) {
  return new Response(...{ error: 'Not authorized' });
}
```

Por uma verificação que usa a função RPC do banco:
```javascript
// Nova verificação (usa is_super_admin do banco)
const { data: isSuperAdmin, error: saError } = await supabase
  .rpc('is_super_admin', { _user_id: user.id });

if (saError || !isSuperAdmin) {
  return new Response(...{ error: 'Not authorized - agency access required' });
}
```

### Por que usar RPC em vez de replicar a lógica?

1. **Fonte única de verdade**: A função `is_super_admin()` já define a regra de negócio
2. **Manutenção simplificada**: Futuras mudanças de regras serão refletidas automaticamente
3. **Consistência**: Mesmo comportamento entre frontend e edge functions

---

## Resumo da Alteração

| Antes | Depois |
|-------|--------|
| Verifica apenas `super_admins` table | Chama `is_super_admin()` via RPC |
| Só Gabriel Facioli consegue configurar | Todos da conta Senseys conseguem |
| Lógica duplicada e inconsistente | Fonte única de verdade |

---

## Arquivos a Modificar

1. **`supabase/functions/meta-accounts/index.ts`** - Trocar verificação direta por chamada RPC

Nenhuma mudança no frontend ou banco de dados é necessária, pois a lógica já está correta nesses lugares.
