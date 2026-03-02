
## Detectar campo REF durante sincronização de formulários (sem depender de leads)

### Problema
Os formulários "R$ 420 Mil | Bairro Nações", "R$ 545 Mil | Bairro Eucaliptos v2" e "R$ 583 Mil - Bairro Eucaliptos v2" não mostram o campo de código de referência porque **ainda não receberam nenhum lead**. A detecção atual depende exclusivamente de dados em `lead_form_field_values`, que está vazia para formulários sem leads.

Porém, quando o `sync-meta-forms` sincroniza esses formulários, ele **já recebe todas as perguntas do Meta** (incluindo campos hidden/texto como REF) -- mas descarta os campos de referência sem registrá-los.

### Solução

1. **Atualizar `sync-meta-forms`** para detectar campos de referência nas perguntas do formulário e salvá-los no `meta_form_configs.reference_field_name` automaticamente (quando ainda não configurado pelo usuário).
   - Durante o processamento das questions, se encontrar um campo cujo `key` está na lista de referência (ref, reference_code, etc.), gravar esse nome no `reference_field_name` do form config.

2. **Atualizar o frontend** (`MetaFormScoringManager.tsx`) para incluir na detecção de REF o valor já salvo em `config.reference_field_name`, garantindo que o seletor mostre o campo mesmo sem leads.

### Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/sync-meta-forms/index.ts` | Ao processar questions, detectar campos de referência e fazer update de `reference_field_name` no form config |
| `src/components/MetaFormScoringManager.tsx` | Incluir `config.reference_field_name` como candidato adicional em `getDetectedRefFields` |

### Detalhes da lógica no sync

No loop de questions do sync-form:
```text
Para cada question:
  Se question.key está em EXCLUDED_FIELD_KEYS (ref, reference_code, etc.):
    -> Registrar como detected_ref_field
    -> Após o loop, fazer UPDATE em meta_form_configs
       SET reference_field_name = detected_ref_field
       WHERE id = formConfigId AND reference_field_name IS NULL
```

Isso garante que:
- Formulários sem leads já mostram o campo REF no seletor
- O valor só é preenchido automaticamente se o usuário ainda não configurou manualmente
- Quando leads chegarem, a vinculação com imóveis já funciona desde o primeiro lead
