

## Correção: Badge "Pendente" não atualiza para "Configurado" após salvar

### Causa Raiz

No `saveConfig` (linha 388-399 de `MetaFormScoringManager.tsx`), o update que define `is_configured: true` está dentro de um `if (updates)` que só executa se o usuário alterou campos de configuração (thresholds). Se o usuário **só editou pontuações das regras** (o caso mais comum), `editedConfigs[configId]` é `undefined`, o bloco é pulado, e `is_configured` nunca é setado como `true` no banco.

### Solução

Mover o update de `is_configured: true` para fora do `if (updates)`, garantindo que sempre seja executado ao salvar, independente de quais campos foram alterados.

### Implementação

**Arquivo: `src/components/MetaFormScoringManager.tsx`**

Linha 388-399 -- substituir a lógica condicional:

```typescript
// ANTES (bug):
const updates = editedConfigs[configId];
if (updates) {
  await supabase.from("meta_form_configs")
    .update({ ...updates, is_configured: true })
    .eq("id", configId);
}

// DEPOIS (fix):
const updates = editedConfigs[configId] || {};
const { error } = await supabase
  .from("meta_form_configs")
  .update({ ...updates, is_configured: true })
  .eq("id", configId);

if (error) throw error;
```

O update agora **sempre** executa com pelo menos `{ is_configured: true }`, mesmo que nenhum threshold tenha sido alterado. Se houver edições nos thresholds, elas são incluídas via spread.

### Resultado esperado

- Ao clicar "Salvar" em qualquer formulário, o badge muda de "Pendente" para "Configurado" imediatamente
- Funciona tanto quando o usuário edita apenas pontuações quanto quando edita thresholds
