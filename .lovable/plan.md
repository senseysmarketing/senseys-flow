
## UI: Melhorias na Interface de Saudação Automática

### O que será feito

Três melhorias visuais e funcionais no card de **Saudação Automática** em `WhatsAppIntegrationSettings.tsx`:

---

### 1. Badge de status da sequência + botões de ação inline

**Situação atual:** O botão "Configurar Sequência de Mensagens" sempre aparece igual, sem nenhum indicador se há uma sequência ativa configurada ou não.

**Novo comportamento:**
- O componente buscará os steps da sequência (da `whatsapp_greeting_sequence_steps`) ao carregar — um count simples por `automation_rule_id`
- Se houver steps ativos → mostra um badge verde "✓ Sequência ativa (N mensagens)" ao lado do botão
- Aparece um botão secundário "Desativar" (toggle `is_active = false` em todos os steps) e um botão de lixeira "Excluir sequência" (com AlertDialog de confirmação)
- O botão principal vira "Editar Sequência" quando já existe uma configurada

**Estrutura visual para o bloco da sequência (fallback rule):**
```
[ ✏ Editar Sequência ]   ● Sequência ativa (3 mensagens)   [Desativar]  [🗑]
Configure 2–5 mensagens enviadas em sequência...
```

O mesmo indicador também aparece para cada regra condicional na lista.

---

### 2. Botão "Personalizar Templates" na mesma linha do toggle

**Situação atual:** "Personalizar Templates" aparece como link pequeno abaixo do select de template, meio escondido.

**Novo comportamento:** Um botão real (`variant="outline"`, `size="sm"`) com ícone de `Settings2`, posicionado à **direita do toggle** de Saudação ativada/desativada — na mesma linha (`flex items-center justify-between`).

**Antes:**
```
[ Toggle ] Saudação ativada                          [     linha     ]
...
[ link Personalizar Templates ]
```

**Depois:**
```
[ Toggle ] Saudação ativada          [ ⚙ Personalizar Templates ]
```

---

### Dados necessários

Será adicionado um novo estado `sequenceCounts` do tipo `Record<string, number>` (mapeando `automation_rule_id | greeting_rule_id` → quantidade de steps ativos). Uma função `fetchSequenceCounts()` fará um único `select` na `whatsapp_greeting_sequence_steps` filtrando `is_active = true`, agrupando os resultados no frontend para montar o mapa.

Novos handlers:
- `handleDisableSequence(automationRuleId?, greetingRuleId?)` — atualiza `is_active = false` em todos os steps correspondentes
- `handleDeleteSequence(automationRuleId?, greetingRuleId?)` — deleta os steps correspondentes (com confirmação via AlertDialog)

---

### Arquivo a modificar

**`src/components/whatsapp/WhatsAppIntegrationSettings.tsx`** — seções:
- Linha ~134: adicionar estado `sequenceCounts`
- Linha ~218: adicionar `fetchSequenceCounts` + incluir no `fetchGreetingRules`/`useEffect`
- Linha ~512-523: linha do toggle → adicionar botão "Personalizar Templates" à direita
- Linha ~545-548: remover o link antigo de "Personalizar Templates"
- Linha ~563-579: bloco da sequência do fallback rule → adicionar badge + botões inline
- Linha ~656-664: cada regra condicional → adicionar badge + botões inline da sequência

---

### Resultado visual esperado

```text
┌─────────────────────────────────────────────────────────────────┐
│ ⚡ Saudação Automática                                           │
│    Mensagem enviada imediatamente quando um novo lead chegar     │
├─────────────────────────────────────────────────────────────────┤
│ [●] Saudação ativada              [ ⚙ Personalizar Templates ]  │
│                                                                  │
│ ─────────────── TEMPLATE PADRÃO (FALLBACK) ──────────────────  │
│  Template de Mensagem          Delay de envio                    │
│  [Saudacao PT1 ▼]              [Imediato ▼]                     │
│                                                                  │
│  [ ✏ Editar Sequência ]  ●verde Sequência ativa (3 mensagens)   │
│                           [Desativar]  [🗑 Excluir]              │
│  Configure 2–5 mensagens enviadas em sequência...               │
└─────────────────────────────────────────────────────────────────┘
```
