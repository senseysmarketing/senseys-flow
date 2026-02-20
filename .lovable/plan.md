
## Correção: Exclusão de Usuário da Equipe

### Diagnóstico

Confirmado via banco de dados: "Gabriel Inumaru" ainda existe na tabela `profiles` (account_id: `05f41011...`) mas sem nenhum `user_role` associado. Isso significa que a edge function `delete-team-member` executou parcialmente:

- Deletou `user_roles` ✅
- Falhou em deletar `profiles` ❌  
- Provavelmente falhou em deletar o usuário do `auth` ❌

### Causa Raiz

Existem dois problemas:

**Problema 1 — Edge function sem tratamento de erro robusto**: A edge function deleta `user_roles` e `profiles` usando o cliente admin (service role), mas se a exclusão do `profile` falhar por qualquer razão (constraint, etc.), a função continua e considera a operação bem-sucedida. O erro é apenas logado (`console.error`) mas não relançado.

**Problema 2 — UI não filtra usuários sem role**: O componente `TeamManagement.tsx` exibe todos os profiles retornados, incluindo aqueles cujo `user_role` foi deletado mas o perfil permaneceu. Isso cria um "fantasma" na lista.

---

### Solução

#### Correção 1 — `supabase/functions/delete-team-member/index.ts`

Tornar a deleção do `profile` mais robusta: verificar o resultado e relançar o erro se falhar. Também adicionar verificação explícita após cada operação:

```typescript
// Deletar user_roles primeiro (FK constraint)
const { error: rolesError } = await supabaseAdmin
  .from('user_roles')
  .delete()
  .eq('user_id', targetUserId);

if (rolesError) {
  throw new Error('Erro ao remover roles do usuário: ' + rolesError.message);
}

// Deletar profile
const { error: profileError } = await supabaseAdmin
  .from('profiles')
  .delete()
  .eq('user_id', targetUserId);

if (profileError) {
  throw new Error('Erro ao remover perfil do usuário: ' + profileError.message);
}

// Deletar do auth
const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

if (deleteError) {
  throw new Error('Erro ao remover usuário do auth: ' + deleteError.message);
}
```

#### Correção 2 — `src/components/TeamManagement.tsx`

Filtrar na função `fetchTeamMembers` para exibir apenas membros que possuem um `user_role` associado (ou seja, membros legítimos), removendo os "fantasmas":

```typescript
// Filtrar: mostrar apenas quem tem role (exceto o proprietário que sempre aparece)
const membersWithRoles = (profiles || [])
  .map(profile => {
    const userRole = userRoles?.find(ur => ur.user_id === profile.user_id);
    return {
      ...profile,
      role: userRole?.roles as { id: string; name: string } | null
    };
  })
  .filter(member => member.role !== null); // Remove membros sem role
```

#### Correção 3 — Limpar o dado "fantasma" do banco

Executar SQL para remover o profile órfão do Gabriel Inumaru que ficou sem role:

```sql
-- Limpar perfil órfão (sem user_role associado)
DELETE FROM profiles 
WHERE user_id = '921060f6-6992-439b-ac9c-9c2b7cbb9f26';
```

E tentar remover o usuário do auth via edge function test ou SQL direto.

---

### Arquivos Alterados

1. **`supabase/functions/delete-team-member/index.ts`** — Melhorar tratamento de erros, verificar resultado de cada operação de deleção
2. **`src/components/TeamManagement.tsx`** — Filtrar membros sem role na função `fetchTeamMembers`
3. **Migração SQL** — Limpar o registro órfão do Gabriel Inumaru do banco
