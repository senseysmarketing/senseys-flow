

## Corrigir Horarios da Agenda para Fuso de Sao Paulo

### Problema

Quando o usuario seleciona um horario no input `datetime-local` (ex: `09:00`), o valor `"2026-02-09T09:00"` e salvo diretamente no Supabase. Como a coluna `start_time`/`end_time` e `timestamp with time zone`, o Supabase interpreta esse valor sem timezone como UTC. Para um usuario em Sao Paulo (UTC-3), o horario salvo fica 3 horas adiantado.

### Solucao

Ao salvar, anexar o offset de Sao Paulo (`-03:00`) ao valor do `datetime-local`. Ao carregar para edicao, converter de volta para o formato local.

### Arquivo a Modificar

**`src/pages/Calendar.tsx`**

### Mudancas

1. **No `handleSubmit`** (linha ~189-190): Antes de salvar, adicionar o sufixo `-03:00` aos valores de `start_time` e `end_time`:

```typescript
const eventData = {
  title: formData.title,
  description: formData.description || null,
  location: formData.location || null,
  start_time: formData.start_time + ":00-03:00",
  end_time: formData.end_time + ":00-03:00",
  lead_id: formData.lead_id || null,
  account_id: accountData,
};
```

Isso garante que `"2026-02-09T09:00"` seja salvo como `"2026-02-09T09:00:00-03:00"`, e o Supabase armazena corretamente como `12:00 UTC` internamente, exibindo `09:00` para Sao Paulo.

2. **Na funcao `handleEdit`** (linha ~224-225): Ao carregar o evento para edicao, usar `date-fns-tz` ou formatacao manual para garantir que o horario exibido no input corresponda ao horario de Sao Paulo. Como `date-fns` `format()` ja usa o fuso local do navegador, e os usuarios estao em Sao Paulo, o `format(new Date(event.start_time), "yyyy-MM-dd'T'HH:mm")` ja deve funcionar corretamente neste ponto -- pois o `new Date()` converte o UTC armazenado para o fuso local do navegador.

3. **Na exibicao de horarios** (linhas ~345, 594, 788-789): O `format(new Date(event.start_time), "HH:mm")` ja converte para o fuso local do navegador, entao a exibicao ficara correta automaticamente apos a correcao do salvamento.

### Resumo

A unica mudanca efetiva e no `handleSubmit`: concatenar `:00-03:00` ao final dos valores de `start_time` e `end_time` antes de enviar ao Supabase. Tudo mais (exibicao e edicao) ja funciona corretamente pois usa `new Date()` que respeita o fuso do navegador.
