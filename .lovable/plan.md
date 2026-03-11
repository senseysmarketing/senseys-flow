

## Diagnostico: Qualificacao de leads Meta ignorando regras de pontuacao

### Causa raiz confirmada com dados do banco

**Bug principal: Case mismatch no `meta-webhook` impede matching de scoring rules**

Na `meta-webhook/index.ts` linha 120, os campos do lead sao indexados em lowercase:
```js
fields[f.name.toLowerCase()] = f.values?.[0] || "";
// Resultado: fields["possui recursos para entrada?"] = "Sim, vou vender imóvel atual"
```

Na linha 135, a busca usa `r.question_name` diretamente (sem lowercase):
```js
fields[r.question_name]  // r.question_name = "Possui recursos para entrada?"
// Resultado: undefined! Key nao encontrada!
```

Dados comprovando (conta Braz, form AP0199-OSWG):

| Origem | question_name / field_name | Case |
|--------|--------------------------|------|
| Scoring rule | `Possui recursos para entrada?` | Title Case |
| Lead field (fields dict) | `possui recursos para entrada?` | lowercase |

Score sempre = 0, temperatura = cold.

Os leads que aparecem como "hot" foram corrigidos pelo `recalculate-lead-temperatures` (que usa normalized comparison corretamente), nao pelo webhook na hora da ingestao.

**Bug secundario: sync-meta-forms reseta configuracao do usuario**

O upsert com `ignoreDuplicates: false` sobrescreve `is_configured: false`, `hot_threshold: 3`, `warm_threshold: 1` toda vez que formularios sao sincronizados, destruindo a configuracao que o usuario fez.

### Plano de correcao

**1. Corrigir matching de scoring no `meta-webhook/index.ts`**

Criar um mapa normalizado dos campos do lead e usar comparacao normalizada (incluindo remocao de `?` e underscores) para encontrar regras correspondentes:

```typescript
// Antes (bug):
for (const r of rules || [])
  if (fields[r.question_name] && normalize(fields[r.question_name]) === normalize(r.answer_value))
    score += r.score;

// Depois (fix):
const fieldsByNorm: Record<string, string> = {};
for (const [k, v] of Object.entries(fields)) fieldsByNorm[normalize(k)] = v;
for (const r of rules || []) {
  const val = fieldsByNorm[normalize(r.question_name)];
  if (val && normalize(val) === normalize(r.answer_value)) score += r.score;
}
```

Tambem atualizar `normalize()` para remover `?` (consistencia com `recalculate-lead-temperatures`).

**2. Corrigir sync-meta-forms para nao sobrescrever config existente**

Mudar os 3 upserts (linhas 235, 458 e o bloco sync-all) para usar `INSERT ... ON CONFLICT DO UPDATE` apenas nos campos que nao destroem a config do usuario:
- Manter upsert apenas para `form_name` e `source_type`
- NAO sobrescrever `is_configured`, `hot_threshold`, `warm_threshold`
- Alternativa: usar insert com `ignoreDuplicates: true` e fazer update separado apenas do `form_name`

**3. Deploy e reprocessamento**

Apos o deploy, executar recalculo de temperatura para leads recentes que chegaram com temperatura errada.

### Arquivos a modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/meta-webhook/index.ts` | Fix normalize + matching de scoring rules (case-insensitive lookup) |
| `supabase/functions/sync-meta-forms/index.ts` | Upsert nao sobrescreve is_configured/thresholds |

