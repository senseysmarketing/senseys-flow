
## Plano: Exibir Botão "Sincronizar Meta" para Todos os Usuários

### Problema Identificado

O botão "Sincronizar Meta" não aparece para usuários da agência (super admins) porque a função `checkMetaConfig` no componente `MetaFormScoringManager.tsx` falha silenciosamente.

**Causa raiz:**
```typescript
const { data: config } = await supabase
  .from("account_meta_config")
  .select("page_id")
  .single();  // <-- Problema aqui!
```

O método `.single()` espera **exatamente 1 linha**. A política RLS permite que super admins vejam **todas** as 12 configurações de Meta da tabela. Quando `.single()` encontra múltiplas linhas, lança um erro, que é capturado e define `hasMetaConfig = false`.

| Tipo de Usuário | Linhas Retornadas | Resultado |
|-----------------|-------------------|-----------|
| Usuário comum   | 1 (seu próprio)   | Funciona  |
| Super admin     | 12 (todos)        | Erro      |

---

### Solução

Adicionar um filtro `account_id` explícito antes de chamar `.single()`, usando a função RPC `get_user_account_id()` do banco de dados.

**De:**
```typescript
const checkMetaConfig = async () => {
  try {
    const { data: config } = await supabase
      .from("account_meta_config")
      .select("page_id")
      .single();
    
    setHasMetaConfig(!!config?.page_id);
  } catch {
    setHasMetaConfig(false);
  }
};
```

**Para:**
```typescript
const checkMetaConfig = async () => {
  try {
    // Primeiro, obter o account_id do usuário atual
    const { data: accountId, error: accountError } = await supabase
      .rpc('get_user_account_id');
    
    if (accountError || !accountId) {
      setHasMetaConfig(false);
      return;
    }
    
    // Buscar config filtrada pelo account_id específico
    const { data: config } = await supabase
      .from("account_meta_config")
      .select("page_id")
      .eq("account_id", accountId)
      .single();
    
    setHasMetaConfig(!!config?.page_id);
  } catch {
    setHasMetaConfig(false);
  }
};
```

---

### Arquivo a Modificar

- **`src/components/MetaFormScoringManager.tsx`** - Atualizar a função `checkMetaConfig` (linhas 90-101)

---

### Resultado Esperado

Após a correção:
- O botão "Sincronizar Meta" aparecerá para **qualquer usuário** cuja conta tenha `page_id` configurado na tabela `account_meta_config`
- Super admins da agência verão o botão ao acessar contas de clientes via modo suporte
- A conta Senseys verá o botão ao acessar suas próprias configurações
