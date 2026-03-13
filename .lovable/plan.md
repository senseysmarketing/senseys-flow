

## Simplificar Sequência de Saudação: Inline Steps ao invés de Modal

### Problema
O botão "Configurar Sequência" abre um modal separado, o que é confuso e adiciona uma camada desnecessária. O follow-up já usa etapas inline com "Adicionar Etapa" — devemos replicar esse padrão na saudação.

### Solução

Substituir o botão "Configurar Sequência" e o modal por **etapas inline** renderizadas diretamente no Step 2 do flow builder, com um botão "+ Adicionar Etapa" no final — igual ao follow-up.

### Mudanças no arquivo `WhatsAppIntegrationSettings.tsx`

**Step 2 (linhas 843-885)**: Remover o bloco do botão "Configurar Sequência" / "Editar Sequência" e substituir por:

1. **Fetch dos steps inline**: Criar um novo state `greetingSequenceSteps` e uma função `fetchGreetingSequenceSteps` que carrega os steps da tabela `whatsapp_greeting_sequence_steps` filtrados pelo `automation_rule_id` do `newLeadRule`. Carregar junto com os outros dados no `loadData`.

2. **Renderizar steps como timeline** (similar ao follow-up):
   - Cada step mostra: "Etapa 2", "Etapa 3", etc. (a etapa 1 é o template principal já configurado acima)
   - Select de template + select de delay em linha
   - Toggle de ativo/inativo + botão de excluir
   - Linha vertical conectora entre etapas

3. **Botão "+ Adicionar Etapa"**: Estilo dashed border, insere diretamente na tabela `whatsapp_greeting_sequence_steps` (como o follow-up faz com `whatsapp_followup_steps`), max 5 etapas

4. **Remover referências ao `showSequenceModal`/`sequenceTarget`** do bloco da saudação padrão (manter para as regras condicionais do Step 3, que continuam usando o modal)

5. **Manter o modal `GreetingSequenceModal`** — ainda é usado pelas regras condicionais no Step 3

### Estrutura visual resultante no Step 2

```text
2. ENVIAR A SEGUINTE MENSAGEM:
  [Template ▾]  [⏱ Delay ▾]  [⚙]     ← Etapa 1 (principal)
  
  ┃ Etapa 2                    [ON] [🗑]
  ┃ [Template ▾]  [⏱ Delay ▾]
  ┃
  ┃ Etapa 3                    [ON] [🗑]
  ┃ [Template ▾]  [⏱ Delay ▾]
  
  [+ Adicionar Etapa]
```

### Detalhes técnicos

- Novo state: `greetingSteps: SequenceStep[]`
- Novo fetch: query `whatsapp_greeting_sequence_steps` where `automation_rule_id = newLeadRule.id`, ordered by `position`
- Insert: mesma lógica do follow-up — insert direto com `account_id` via `get_user_account_id`, `automation_rule_id`, position, delay default (5s para greeting vs minutos para follow-up)
- Delete/toggle: update/delete direto na tabela, re-fetch
- Remover `sequenceCounts` da saudação padrão (calcular inline pelo length do array)
- Estilo: usar o mesmo visual de flow com dots + linhas verticais já usado no Step 2

