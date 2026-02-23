

## Correcao: Deteccao de Resposta do Lead com Fallback via Evolution API

### Problema Identificado

O lead "Salomao Teste" respondeu as 08:13 (horario SP) com "bom dia" e "claro! Quando podemos marcar uma cal?", mas o sistema enviou outra mensagem de follow-up as 12:00 mesmo assim.

**Causa raiz**: A conta Senseys (05f41011) possui **zero mensagens recebidas** armazenadas na tabela `whatsapp_messages`. O webhook da Evolution API nao esta entregando os eventos de mensagens recebidas para esta instancia. Como a deteccao de resposta do lead no `process-whatsapp-queue` consulta apenas o banco de dados (`whatsapp_messages`), ela nao encontra nenhuma resposta e procede com o envio do follow-up.

A configuracao do webhook esta correta no codigo (e reconectada automaticamente ao checar status), mas por alguma razao operacional na Evolution API, os eventos de incoming messages nao estao chegando para esta instancia especifica.

### Solucao

Adicionar uma **segunda camada de verificacao** no `process-whatsapp-queue`: alem de consultar o banco de dados, tambem consultar a Evolution API diretamente (endpoint `chat/findMessages`) para verificar se existem mensagens recebidas do lead. Isso funciona como uma "rede de seguranca" quando o webhook falha.

### Alteracoes Tecnicas

**Arquivo: `supabase/functions/process-whatsapp-queue/index.ts`**

Na secao de deteccao de resposta do lead (linhas 236-273), apos as duas consultas ao banco (`incomingByPhone` e `incomingByLeadId`), adicionar uma terceira verificacao caso ambas retornem vazio:

1. Buscar a sessao do WhatsApp para obter o `instance_name`
2. Chamar `POST /chat/findMessages/{instance}` na Evolution API com o `remoteJid` do telefone do lead
3. Filtrar as mensagens retornadas por `key.fromMe === false`
4. Se encontrar alguma, considerar que o lead respondeu e cancelar os follow-ups pendentes
5. Tambem armazenar essas mensagens no banco (sync de seguranca) para que futuras verificacoes nao precisem ir na API

```text
Fluxo de decisao:

1. Consultar whatsapp_messages por telefone -> respondeu? SIM -> cancelar
2. Consultar whatsapp_messages por lead_id  -> respondeu? SIM -> cancelar
3. (NOVO) Consultar Evolution API findMessages -> respondeu? SIM -> cancelar + salvar msgs no DB
4. Nenhuma resposta encontrada -> prosseguir com envio
```

A consulta a API sera feita apenas quando as verificacoes no banco nao encontrarem resposta, evitando chamadas desnecessarias. A API sera consultada com limit de mensagens recentes para minimizar latencia.

Alem disso, sera adicionado um log de diagnostico quando a resposta e detectada via API mas nao via banco, indicando que o webhook da instancia pode estar com problema.

**Resumo**:
- 1 arquivo alterado: `supabase/functions/process-whatsapp-queue/index.ts`
- Deploy da edge function apos alteracao
- Impacto: follow-ups serao cancelados mesmo quando o webhook falha em registrar mensagens recebidas

