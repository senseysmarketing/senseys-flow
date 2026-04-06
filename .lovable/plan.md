

## Alterar Senha do Cliente Fabio

### Abordagem

Executar um script que usa a API Admin do Supabase (service role) para localizar o usuário pelo email `referencehome@hotmail.com` e atualizar a senha para `@Reference123`.

### Passo único

Rodar um script via `code--exec` que:
1. Busca o `user_id` do usuário com email `referencehome@hotmail.com` na API Admin do Supabase
2. Chama `PUT /auth/v1/admin/users/{user_id}` com `{ "password": "@Reference123" }` usando a service role key

Nenhuma alteração de código no projeto é necessária — é uma operação administrativa pontual.

