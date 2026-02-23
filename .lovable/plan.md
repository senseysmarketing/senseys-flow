
## Correcao: Automacao WhatsApp no meta-webhook desatualizada

### Problema
A edge function `meta-webhook` usa um bloco de automacao WhatsApp simplificado e desatualizado (linhas 243-299) que:

1. **Nao suporta regras condicionais de saudacao** (`whatsapp_greeting_rules`) - apenas usa a tabela antiga `whatsapp_automation_rules`
2. **Nao suporta sequencias de mensagens** (`whatsapp_greeting_sequence_steps`) - envia apenas 1 mensagem
3. **Engole todos os erros** com `catch {}` vazio - impossivel diagnosticar falhas
4. **Nao substitui a variavel `{imovel}`** no template

Enquanto isso, a funcao `webhook-leads` ja possui a implementacao completa e moderna com todas essas funcionalidades.

### Solucao

Substituir o bloco de automacao WhatsApp no `meta-webhook` (linhas 243-299) pela mesma logica presente no `webhook-leads` (linhas 533-743), adaptada ao contexto do meta-webhook.

### Detalhes Tecnicos

**Arquivo: `supabase/functions/meta-webhook/index.ts`**

Substituir o bloco inteiro (linhas 243-299) pela seguinte logica:

1. Verificar sessao WhatsApp conectada
2. Buscar regras condicionais de saudacao (`whatsapp_greeting_rules`) ordenadas por prioridade
3. Buscar informacoes do imovel vinculado (preco, tipo, transacao) para matching de regras
4. Avaliar regras condicionais na ordem de prioridade:
   - `property` - imovel especifico
   - `price_range` - faixa de preco
   - `property_type` - tipo de imovel
   - `transaction_type` - tipo de transacao
   - `campaign` - campanha
   - `origin` - origem
   - `form_answer` - resposta de formulario Meta
5. Se nenhuma regra condicional bater, usar fallback para `whatsapp_automation_rules` (comportamento atual), verificando se a fonte `meta` esta habilitada
6. Verificar se ha sequencia de mensagens (`whatsapp_greeting_sequence_steps`) para a regra/automacao selecionada
7. Se houver sequencia, enfileirar todas as mensagens com delays acumulados
8. Se nao houver sequencia, enfileirar mensagem unica (comportamento atual)
9. Substituir variaveis incluindo `{imovel}`
10. Trocar `catch {}` por `catch (e) { console.error(...) }`

Tambem corrigir os outros `catch {}` vazios nas linhas 241 e 316 para logar erros.

**Variaveis ja disponiveis no contexto do meta-webhook:**
- `cfg.account_id` - ID da conta
- `newLead.id` - ID do lead criado
- `name`, `phone`, `email` - dados do lead
- `propId` - ID do imovel vinculado (pode ser null)
- `campName` - nome da campanha
- `isIg` - se e Instagram

**Adaptacoes necessarias em relacao ao webhook-leads:**
- A variavel de origem usa `isIg ? "Instagram" : "Facebook"` em vez de `leadData.origem`
- A variavel de imovel precisa buscar `propertyName` via query (ja existe busca similar na linha 239)
- O `callSource` sera fixo como `'meta'` (em vez de `'webhook'` ou `'olx'`)
