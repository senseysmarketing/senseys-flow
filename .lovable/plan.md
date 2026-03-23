

## Resetar Senha do Usuário

### Ação
Usar a API Admin do Supabase (via service_role) para alterar a senha do usuário `caiquemarinho@hotmail.com` para `@Marinho123`.

### Passos
1. Buscar o `user_id` do email na tabela `auth.users` via query
2. Chamar `supabase.auth.admin.updateUserById()` com a nova senha via edge function temporária ou curl

### Implementação
- Executar um curl direto na Auth Admin API do Supabase com o service_role key para atualizar a senha, sem necessidade de criar arquivos

