
## Variáveis de Formulário Meta nos Templates + Condição por Resposta de Formulário nas Regras

### Contexto e Objetivo

O usuário quer duas melhorias relacionadas:

1. **No modal "Gerenciar Templates"**: Adicionar um botão "Mostrar mais variáveis" que, ao clicar, busca e exibe as perguntas dos formulários Meta cadastrados (ex: `{resposta_quando_pretende_comprar}`) — apenas se existirem.

2. **Nas Regras Condicionais de Saudação**: Adicionar um novo tipo de condição "Resposta de Formulário Meta", onde o usuário seleciona uma pergunta e define qual resposta deve acionar aquela regra.

---

### Parte 1 — Variáveis Dinâmicas de Formulários Meta nos Templates

#### Como funciona

A tabela `meta_form_scoring_rules` já contém todas as perguntas configuradas (`question_name`, `question_label`) da conta. Essas perguntas podem virar variáveis de template no formato `{form_pergunta}`.

**Exemplo**: A pergunta `quando_pretende_comprar?` vira a variável `{form_quando_pretende_comprar}`.

Durante o envio da mensagem (edge function `process-whatsapp-queue`), a variável seria substituída pelo valor real da resposta que o lead deu naquele formulário (tabela `lead_form_field_values`).

#### Mudanças no `WhatsAppTemplatesModal.tsx`

- Buscar perguntas distintas de `meta_form_scoring_rules` da conta (agrupadas por `question_name` e `question_label`).
- Adicionar estado `showMoreVars: boolean` e `formVars: { code, label }[]`.
- Na seção "Variáveis Disponíveis" da list view: adicionar botão "Mostrar mais variáveis" que só aparece se `formVars.length > 0`. Ao clicar, expande um grid com as variáveis de formulário.
- Na form view (editor de template): as variáveis de formulário também aparecem (colapsadas por padrão) para inserção via clique.

#### Mudanças na Edge Function `process-whatsapp-queue`

Ao processar o template antes do envio, após substituir as variáveis padrão (`{nome}`, `{email}`, etc.), identificar variáveis com prefixo `{form_*}`, buscar o valor correspondente em `lead_form_field_values` para o lead e substituir.

---

### Parte 2 — Novo Tipo de Condição: Resposta de Formulário Meta

#### Necessidade de migração DB

A tabela `whatsapp_greeting_rules` precisa de duas novas colunas:
- `condition_form_question TEXT` — nome da pergunta (ex: `quando_pretende_comprar?`)
- `condition_form_answer TEXT` — valor esperado da resposta (ex: `Imediatamente (até 30 dias)`)

#### Mudanças no `GreetingRuleModal.tsx`

Adicionar novo tipo de condição: **🗂️ Resposta de Formulário Meta**.

Quando selecionado:
1. Primeiro select: lista as perguntas distintas disponíveis na conta (de `meta_form_scoring_rules`).
2. Segundo select: ao escolher a pergunta, lista os valores de resposta já conhecidos para aquela pergunta (também de `meta_form_scoring_rules`).

O usuário seleciona pergunta + resposta, e qualquer lead cujo formulário contenha aquela resposta receberá essa saudação personalizada.

#### Mudanças na Edge Function `notify-new-lead`

Ao avaliar as regras condicionais:
- Para regras com `condition_type = 'form_answer'`:
  - Buscar `lead_form_field_values` do lead para encontrar a resposta à pergunta `condition_form_question`.
  - Normalizar a resposta (lowercase, remove interrogações, substitui underscores por espaços — seguindo o padrão já existente).
  - Comparar com `condition_form_answer` normalizado.
  - Se houver match → usar esse template.

---

### Resumo dos Arquivos a Modificar

1. **`supabase/migrations/nova_migration.sql`** — Adicionar colunas `condition_form_question` e `condition_form_answer` na tabela `whatsapp_greeting_rules`.

2. **`src/components/whatsapp/WhatsAppTemplatesModal.tsx`**:
   - Buscar perguntas de formulários Meta da conta.
   - Mostrar botão "Mostrar mais variáveis" (só se existirem perguntas).
   - Expandir variáveis dinâmicas de formulário ao clicar.
   - Disponibilizar essas variáveis para inserção no editor de template.

3. **`src/components/whatsapp/GreetingRuleModal.tsx`**:
   - Adicionar novo `condition_type = 'form_answer'` ao enum `CONDITION_TYPES`.
   - Adicionar campos `condition_form_question` e `condition_form_answer` ao estado do formulário.
   - Buscar perguntas da conta em `meta_form_scoring_rules`.
   - Renderizar dois selects em cascata (pergunta → resposta) quando `form_answer` for selecionado.
   - Incluir as novas colunas no payload de save.

4. **`supabase/functions/notify-new-lead/index.ts`** — Adicionar avaliação de `condition_type = 'form_answer'` usando `lead_form_field_values`.

5. **`supabase/functions/process-whatsapp-queue/index.ts`** — Adicionar substituição de variáveis `{form_*}` buscando os dados de `lead_form_field_values` do lead.

6. **`src/integrations/supabase/types.ts`** — Atualizar o tipo da tabela `whatsapp_greeting_rules` com as novas colunas.

---

### Fluxo Completo (exemplo real)

```text
Lead chega via Meta Ads, respondeu:
  "Quando pretende comprar?" → "Imediatamente (até 30 dias)"

Sistema avalia regras condicionais por prioridade:
  Regra 1: condition_type = 'form_answer'
           condition_form_question = 'quando_pretende_comprar?'
           condition_form_answer   = 'imediatamente (até 30 dias)'
           template_id = "Saudação Urgente"  ✓ MATCH

  → Envia: "Olá {nome}! Vi que você quer comprar imediatamente, 
             vou te ligar em breve para conversarmos!"
```

```text
Template com variável de formulário:
  "Olá {nome}! Sua resposta foi: {form_quando_pretende_comprar?}. 
   Vou entrar em contato para explicar nossas condições!"

Enviado ao lead que respondeu "Até 3 meses":
  "Olá João! Sua resposta foi: Até 3 meses. 
   Vou entrar em contato para explicar nossas condições!"
```
