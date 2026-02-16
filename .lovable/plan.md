

## Correcao do bug visual do Modo Suporte

### Problema
Quando o usuario fica um tempo sem acessar o sistema enquanto esta no Modo Suporte, a sessao do cliente expira e o Supabase restaura automaticamente a sessao original (Senseys). Porem, o `localStorage` ainda contem `support_mode_active: "true"`, fazendo o banner amarelo aparecer incorretamente. Ao clicar em "Voltar para Agencia", o sistema tenta restaurar uma sessao de backup ja expirada, causando erros.

### Solucao

Validar ativamente se o Modo Suporte ainda e legitimo, comparando o usuario atual com o usuario da agencia (backup).

### Detalhes tecnicos

**Arquivo: `src/hooks/use-support-mode.tsx`**

1. **Armazenar o user_id da agencia** ao salvar a sessao de backup (novo campo `agency_user_id` no localStorage)

2. **Escutar mudancas de autenticacao** (`onAuthStateChange`) dentro do hook. Quando o usuario muda:
   - Obter o `user.id` atual
   - Comparar com o `agency_user_id` armazenado
   - Se forem iguais, significa que a sessao voltou para a agencia sozinha - limpar automaticamente os flags de Modo Suporte (`support_mode_active`, `agency_backup_session`, `support_account_name`)
   - Isso faz o banner desaparecer imediatamente

3. **Validar na montagem** (useEffect existente): alem de checar se as flags existem no localStorage, tambem verificar se o usuario atual e diferente do usuario da agencia no backup. Se forem iguais, limpar tudo.

**Arquivo: `src/pages/AgencyAdmin.tsx`**

4. Ao salvar o backup da sessao, tambem armazenar o `user.id` da agencia no localStorage (nova chave `agency_backup_user_id`).

### Fluxo corrigido

```text
Usuario entra no Modo Suporte (sessao do cliente)
    |
Fica tempo sem acessar
    |
Sessao do cliente expira, Supabase restaura sessao Senseys
    |
onAuthStateChange dispara -> user.id === agency_backup_user_id?
    |
  SIM -> Limpa flags do localStorage, banner desaparece
    |
Usuario ve a interface normal da conta Senseys
```

### Arquivos modificados

- `src/hooks/use-support-mode.tsx` - Adicionar validacao ativa com `onAuthStateChange` e comparacao de user_id
- `src/pages/AgencyAdmin.tsx` - Salvar `user.id` da agencia junto com o backup da sessao

