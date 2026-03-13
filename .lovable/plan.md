

## Refatoração: Saudação Automática como Automation Flow Builder

### Escopo

Reescrever o bloco "Saudação Automática" (linhas 728-998 de `WhatsAppIntegrationSettings.tsx`) mantendo toda a lógica/state existente, mas com layout e visual completamente novos.

### Estrutura Visual

```text
┌─────────────────────────────────────────────────────┐
│  ⚡ Saudação Automática                    [Toggle] │
│  Mensagem enviada quando um novo lead chegar        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┃  1. Quando um lead chegar de:                    │
│  ┃     [Manual] [Meta Ads] [Webhook] [Grupo OLX]   │
│  ┃                                                  │
│  ┃  2. Enviar a seguinte mensagem:                  │
│  ┃     [Template ▾]  [⏱ Delay ▾]  [⚙ Templates]   │
│  ┃     [Sequência: Editar | ✓ 3 msgs | Desativar]  │
│  ┃                                                  │
│  ┃  3. Condições Específicas (Opcional)             │
│  ┃     ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐            │
│  ┃     ╎  + Adicionar Condição         ╎            │
│  ┃     └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘            │
│  ┃     (ou regras existentes em blocos)             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Detalhes Técnicos

**Arquivo**: `src/components/whatsapp/WhatsAppIntegrationSettings.tsx` (linhas ~728-998)

#### 1. Card Container (substitui o `<Card>` atual)
- Remover `<Card>`, usar `<div>` com classes: `bg-[#5a5f65]/40 backdrop-blur-sm border border-white/10 rounded-xl`
- Header: título + subtítulo à esquerda, Switch à direita com classes condicionais para glow quando ativo: `data-[state=checked]:bg-[#81afd1] data-[state=checked]:shadow-[0_0_12px_rgba(129,175,209,0.4)]`

#### 2. Linha de Flow Vertical
- Envolver os 3 passos em um container `relative pl-6`
- Pseudo-elemento via `<div>` absoluto no lado esquerdo: `absolute left-[11px] top-0 bottom-0 w-px bg-white/10`
- Cada passo terá um "dot" no lado esquerdo: `absolute left-[7px] w-[9px] h-[9px] rounded-full bg-[#81afd1] border-2 border-[#2b2d2c]`

#### 3. Passo 1 — Gatilhos (Sources)
- Label: `"1. Quando um lead chegar de:"` em `text-xs text-[#a6c8e1]/70 uppercase tracking-wide`
- Substituir os `<Checkbox>` + `<Label>` por pills clicáveis:
  - Selecionada: `bg-[#2b2d2c]/60 border-[#81afd1] text-white`
  - Não selecionada: `bg-transparent border-white/15 text-white/40`
  - Todas: `px-3 py-1.5 rounded-full text-xs cursor-pointer transition-all`
- Mesma lógica de `updateRuleSources` no onClick

#### 4. Passo 2 — Ação (Template + Delay)
- Label: `"2. Enviar a seguinte mensagem:"`
- Layout em `flex gap-2 items-center` numa única linha:
  - Select do template (`flex-1`)
  - Select do delay (width fixo ~140px)
  - Botão "Personalizar Templates" como ícone-only ou compacto
- Inputs com `bg-[#2b2d2c]/50 border-white/10`
- Seção de sequência abaixo, compacta

#### 5. Passo 3 — Condições
- Label: `"3. Condições Específicas (Opcional)"`
- Empty state: apenas um botão `border-dashed border-white/20 rounded-lg` com `<GitBranch>` + "Adicionar Condição", sem a caixa grande vazia
- Regras existentes: manter os blocos atuais mas com estilo atualizado (`bg-[#2b2d2c]/30 border-white/10`)
- Nota explicativa no final em `text-[#a6c8e1]/50`

### O que NÃO muda
- Toda a lógica de state, handlers, Supabase queries
- O bloco de Follow-up (coluna direita) — não é tocado
- Os modais (GreetingRuleModal, SequenceModal, TemplatesModal)
- O bloco de conexão e horário de envio acima

