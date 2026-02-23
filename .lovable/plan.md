

## Solucao: Motor de Correlacao Temporal + Sync Proativo de Respostas @lid

### Causa Raiz

O WhatsApp Business API utiliza identificadores privados chamados `@lid` (Linked IDs). Quando um lead responde, a mensagem chega com um JID como `135695549116612@lid` em vez do numero real `5516993157946@s.whatsapp.net`. O sistema nao consegue fazer essa associacao, entao:

- A resposta fica salva no banco com `lead_id = NULL`
- Todas as verificacoes pre-envio (por telefone e por lead_id) falham
- O fallback via Evolution API tambem falha porque busca pelo JID do telefone, nao pelo @lid
- Os follow-ups continuam sendo enviados normalmente

Dados confirmados: a conta ANZ Imoveis tem **53 mensagens recebidas via @lid** sem `lead_id`, todas sendo respostas ignoradas pelo sistema.

A timeline do lead "anna julia blanca" comprova: a resposta "bom dia, pode sim." chegou **24 segundos** apos a saudacao, mas nunca foi associada ao lead.

### Solucao Proposta: 3 Camadas de Protecao

A ideia principal e resolver o problema na raiz: **associar automaticamente as respostas @lid aos leads corretos usando correlacao temporal**. Quando enviamos uma saudacao as 13:21:01 e recebemos uma resposta @lid as 13:21:25, podemos inferir com alta confianca que e a mesma pessoa.

#### Camada 1: Nova edge function `sync-whatsapp-replies` (cron a cada 3 minutos)

Uma funcao que roda continuamente em segundo plano e resolve mensagens @lid pendentes:

1. Busca todas as mensagens @lid recebidas que tem `lead_id = NULL`
2. Para cada uma, procura a mensagem de saudacao enviada (outgoing) mais recente que foi enviada ANTES da resposta @lid
3. Se a saudacao foi enviada dentro de uma janela de 60 minutos antes da resposta @lid, associa automaticamente:
   - Atualiza o `lead_id` na mensagem @lid
   - Salva o mapeamento `lid_jid` na conversa do lead
   - Cancela TODOS os follow-ups pendentes desse lead
4. Loga cada associacao feita para auditoria

Algoritmo de correlacao:
```text
Para cada mensagem @lid (incoming, lead_id = NULL):
  1. Buscar TODAS as saudacoes enviadas (outgoing, lead_id NOT NULL) 
     nos 60 minutos ANTES da resposta @lid
  2. Ordenar por timestamp DESC (mais recente primeiro)
  3. A saudacao mais recente e o "match" mais provavel
  4. Verificar se nao existe outro @lid ja associado a esse lead
  5. Se OK -> associar e cancelar follow-ups
```

#### Camada 2: Verificacao @lid no pre-envio do follow-up (process-whatsapp-queue)

Adicionar uma nova verificacao ANTES de enviar qualquer follow-up:

1. Buscar o timestamp da saudacao enviada para este lead (msg com `automation_rule_id` e sem `followup_step_id`, status `sent`)
2. Procurar mensagens @lid recebidas (incoming, `lead_id IS NULL`) que chegaram DENTRO de 60 minutos apos a saudacao
3. Se encontrar -> o lead respondeu -> cancelar follow-ups

Isso funciona como "rede de seguranca" caso o cron ainda nao tenha processado a correlacao.

#### Camada 3: Captura proativa do @lid no envio (whatsapp-send)

Quando o `whatsapp-send` envia uma mensagem via Evolution API, a resposta da API pode conter informacoes sobre o @lid do destinatario. Capturar e salvar esse mapeamento na conversa para futuras consultas.

### Alteracoes Tecnicas

**Arquivo 1: `supabase/functions/sync-whatsapp-replies/index.ts` (NOVO)**

Nova edge function cron que:
- Busca mensagens @lid sem lead_id
- Busca saudacoes enviadas (outgoing com lead_id)
- Correlaciona temporalmente (janela de 60 min)
- Atualiza lead_id, lid_jid e cancela follow-ups

**Arquivo 2: `supabase/functions/process-whatsapp-queue/index.ts` (ALTERACAO)**

Na secao de verificacao pre-envio (linhas 236-394), adicionar ANTES do fallback da Evolution API:

```text
// Nova verificacao: correlacao temporal com @lid
1. Buscar a saudacao enviada para este lead (sent, sem followup_step_id)
2. Se encontrar, buscar mensagens @lid incoming (lead_id IS NULL) 
   que chegaram dentro de 60 min apos a saudacao
3. Se encontrar -> leadHasResponded = true
4. Tambem: atualizar o lead_id da mensagem @lid encontrada (resolver a associacao)
```

**Arquivo 3: `supabase/functions/whatsapp-send/index.ts` (ALTERACAO)**

Apos enviar com sucesso, verificar se `sendData.key.remoteJid` contem um @lid e salvar na conversa como `lid_jid`.

### Configuracao do Cron

Registrar o `sync-whatsapp-replies` para rodar a cada 3 minutos via cron do Supabase, similar ao `process-whatsapp-queue`.

### Resultado Esperado

| Cenario | Antes | Depois |
|---------|-------|--------|
| Lead responde via @lid | Nao detectado, follow-ups continuam | Detectado em ate 3 min pelo cron, follow-ups cancelados |
| Pre-envio de follow-up | So verifica por telefone e lead_id | Tambem verifica correlacao temporal com @lid |
| @lid sem mapeamento | Fica como "mensagem fantasma" sem lead | Associado automaticamente ao lead correto |

### Acao Imediata

Alem da implementacao, cancelar o FU3 pendente da anna julia blanca e resolver as 53 mensagens @lid pendentes da ANZ Imoveis retroativamente.

