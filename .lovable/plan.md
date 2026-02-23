
## Correcao: Retry com Backoff + Delay entre Envios + Mensagens de Erro Amigaveis

### Problema

Sim, o erro "Bad Request" pode absolutamente ser causado por envios rapidos demais. A Evolution API tem rate limiting implicito, e quando o `process-whatsapp-queue` processa ate 50 mensagens em sequencia sem nenhum delay, ou quando um usuario envia mensagens manualmente em rapida sucessao, a API pode rejeitar com 400 "Bad Request".

Alem disso, quando o erro acontece, o sistema mostra a mensagem crua da API em vez de algo util para o usuario.

### Solucao: 3 Melhorias

#### 1. Delay entre envios no process-whatsapp-queue

Adicionar um `await sleep(1500)` (1.5 segundos) entre cada mensagem processada no loop principal. Isso evita sobrecarregar a Evolution API quando ha muitos follow-ups agendados no mesmo minuto.

#### 2. Retry automatico com backoff no whatsapp-send

Quando a Evolution API retorna 400 ou 500, aguardar 3 segundos e tentar novamente uma unica vez antes de reportar erro. Isso cobre erros temporarios de rate limiting.

#### 3. Mensagens de erro em portugues amigavel

Mapear os codigos de erro da Evolution API para mensagens claras para o usuario:
- 400 -> "Erro temporario. Tente novamente em alguns segundos."
- 404 -> "Sessao nao encontrada. Reconecte o WhatsApp."
- 408/timeout -> "Servidor nao respondeu. Tente novamente."

### Alteracoes Tecnicas

**Arquivo 1: `supabase/functions/whatsapp-send/index.ts`**

- Extrair a logica de envio para a Evolution API em uma funcao `sendWithRetry()` que:
  1. Tenta enviar normalmente
  2. Se receber 400/500, aguarda 3 segundos e tenta novamente (1 retry)
  3. Loga ambas as tentativas
- Adicionar funcao `normalizeError(status, data)` que converte erros para portugues
- Aplicar no ponto onde a mensagem e enviada (linhas 117-131)

**Arquivo 2: `supabase/functions/process-whatsapp-queue/index.ts`**

- Adicionar funcao `sleep(ms)` no topo do arquivo
- Inserir `await sleep(1500)` apos cada envio bem-sucedido no loop (apos linha 638)
- Isso garante intervalo minimo de 1.5s entre mensagens da mesma conta

### Resultado Esperado

| Cenario | Antes | Depois |
|---------|-------|--------|
| 10 follow-ups no mesmo minuto | Todos enviados em ~2s, risco de 400 | Enviados em ~15s com delay, sem rejeicao |
| Erro 400 temporario | Falha imediata, "Bad Request" | Retry apos 3s, segunda chance de sucesso |
| Erro mostrado ao usuario | "Bad Request" | "Erro temporario. Tente novamente em alguns segundos." |
