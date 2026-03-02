

## Correção: Badge "Pendente" persiste + campo REF não aparece nos dados do lead

### Problema 1: Badge "Pendente" não atualiza ao salvar (RLS)

**Causa raiz**: A policy de UPDATE na tabela `meta_form_configs` exige `account_id = get_user_account_id()`. Quando um super admin da agencia Senseys (conta `05f41011...`) edita configs de um cliente como Rodrigo Lima (conta `58140b79...`), o UPDATE do Supabase retorna sucesso mas afeta **0 linhas**, pois a conta não coincide. O código não detecta essa falha silenciosa.

Os dados confirmam: todos os 7 formulários do Rodrigo Lima continuam com `is_configured: false` no banco, apesar de o toast "Configuração salva" ter aparecido.

**Solução**: Adicionar uma policy RLS que permita super admins fazerem UPDATE em `meta_form_configs`:

```sql
CREATE POLICY "Super admins can update form configs"
ON public.meta_form_configs
FOR UPDATE
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));
```

Nota: Já existe uma policy `Service role can manage form configs` para o service_role, mas super admins autenticados via client-side (anon key) não têm esse privilégio. A policy existente para SELECT já permite visualizar, mas o UPDATE falha silenciosamente.

### Problema 2: Campo REF não aparece nos dados do formulário

**Causa raiz**: No `meta-webhook/index.ts`, linha 39, o campo `"ref"` está na lista `EXCLUDED_FIELDS`:

```typescript
const EXCLUDED_FIELDS = new Set([...BASIC_FIELDS, "reference_code", "ref", "codigo_referencia", "codigo_imovel"]);
```

Isso faz com que na linha 222, quando os campos do formulário são salvos em `lead_form_field_values`, o campo `ref` seja pulado. O valor é usado corretamente para vincular o lead ao imóvel (linha 141-167), mas nunca é armazenado para visualização no painel do lead.

**Solução**: Remover os campos de referência do `EXCLUDED_FIELDS` e em vez disso salvá-los normalmente em `lead_form_field_values`. O campo continuará sendo usado para vinculação de imóvel (linha 141), e agora também ficará visível nos dados do formulário no modal do lead.

Alterar linha 39:
```typescript
const EXCLUDED_FIELDS = new Set([...BASIC_FIELDS]);
```

Os campos de referência (`ref`, `reference_code`, etc.) ainda serão processados para vinculação de imóvel na linha 141, mas agora também serão armazenados em `lead_form_field_values` para exibição.

Também precisamos garantir que esses campos de referência **não apareçam** nas regras de pontuação do frontend (eles já estão na lista `EXCLUDED_FIELD_NAMES` do `MetaFormScoringManager.tsx` linha 322, então isso já funciona corretamente).

### Arquivos a modificar

| Recurso | Mudança |
|---------|---------|
| Migration SQL | Adicionar policy RLS para super admins no UPDATE de `meta_form_configs` |
| `supabase/functions/meta-webhook/index.ts` | Remover campos ref do `EXCLUDED_FIELDS` |

### Resultado esperado

1. Super admins conseguem salvar configurações de qualificação de qualquer conta, e o badge atualiza para "Configurado" imediatamente
2. O campo REF do formulário Meta aparece nos dados do formulário no modal do lead
3. A vinculação automática de imóvel por reference_code continua funcionando normalmente

