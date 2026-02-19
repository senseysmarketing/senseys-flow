
## Integração Grupo OLX — Recebimento de Leads via Webhook

### Visão Geral

O Grupo OLX (que engloba OLX, VivaReal, ZAP Imóveis) envia leads com um JSON próprio, diferente do formato padrão do CRM. A solução usa a arquitetura "hub-and-spoke" já descrita nos documentos do projeto: uma Edge Function dedicada (`olx-webhook`) que recebe o payload OLX, normaliza os dados e os encaminha para o `webhook-leads` interno existente — reaproveitando toda a lógica de distribuição, qualificação, notificação e automação WhatsApp que já existe.

Na tela de Configurações, uma nova aba "Grupo OLX" aparecerá ao lado de "Webhook" com a URL exclusiva do portal e instruções de configuração.

---

### Mapeamento de Campos OLX → CRM

| Campo OLX | Campo CRM | Observação |
|---|---|---|
| `name` | `name` | Nome do lead |
| `ddd` + `phone` | `phone` | Concatenados: `ddd + phone` |
| `email` | `email` | Email |
| `message` | `observacoes` | Mensagem/interesse |
| `clientListingId` | Busca imóvel por `reference_code` | Vincula propriedade automaticamente |
| `temperature` (Baixa/Média/Alta) | `temperature` (cold/warm/hot) | Mapeamento de temperatura |
| `leadOrigin` | `origem` | "Grupo OLX" |
| `transactionType` | `interesse` | "SELL" → "Compra" / "RENT" → "Aluguel" |
| `extraData.leadType` | `campanha` | Tipo de contato (chat, formulário, etc.) |
| `originLeadId` | `meta_lead_id` | ID externo do lead para rastreio de duplicatas |

---

### Componentes a criar/modificar

**1. Nova Edge Function: `supabase/functions/olx-webhook/index.ts`**

- Rota pública que o Grupo OLX chamará: `POST /olx-webhook?account_id=<uuid>`
- Valida que o payload contém o campo `leadOrigin` (fingerprint OLX)
- Normaliza todos os campos conforme a tabela acima
- Tenta vincular a propriedade pelo `clientListingId` como `reference_code` via busca no banco
- Mapeia temperatura: "Alta" → `hot`, "Média" → `warm`, "Baixa" → `cold`
- Detecta duplicatas pelo `originLeadId` (salvo em `meta_lead_id`) antes de encaminhar
- Invoca `webhook-leads` internamente com o payload normalizado já no formato CRM padrão

**2. Nova aba em Configurações: `src/components/OlxIntegrationSettings.tsx`**

Componente visual para a aba, exibindo:
- URL do webhook OLX (com `account_id` já incluído), campo somente leitura com botão copiar
- Instruções passo a passo de como configurar no painel do Grupo OLX / VivaReal / ZAP
- Tabela de mapeamento de campos (o que cada campo do OLX vira no CRM)
- Informações sobre vinculação automática de imóveis (usando `clientListingId` como código de referência)
- Status de ativação: badge "Ativo" (sempre ativo quando account_id configurado)
- Botão de "Simular Lead" para testes com payload de exemplo no formato OLX

**3. Atualização de `src/pages/Settings.tsx`**

- Adicionar `'olx'` ao tipo `TabValue`
- Adicionar aba "Grupo OLX" com ícone `Building2` (ou similar) na lista `navItems`, **ao lado do Webhook**
- Adicionar `case 'olx'` no `renderContent()` retornando `<OlxIntegrationSettings />`
- Atualizar `validTabs` no `useMemo`

---

### Fluxo de funcionamento

```text
Grupo OLX / VivaReal / ZAP
        |
        | POST /olx-webhook?account_id=xxx
        | Payload no formato OLX
        v
[olx-webhook Edge Function]
        |
        |-- Valida account_id
        |-- Detecta duplicata via originLeadId
        |-- Normaliza campos OLX → CRM
        |-- Busca imóvel por clientListingId = reference_code
        |-- Chama webhook-leads internamente
        v
[webhook-leads Edge Function] (já existente)
        |
        |-- Aplica regras de distribuição
        |-- Envia notificações
        |-- Agenda automação WhatsApp
        v
Lead criado no CRM com origem "Grupo OLX"
```

---

### Detalhes técnicos

**Autenticação do OLX:** O Grupo OLX não envia header de autenticação — a URL com `account_id` serve como token de roteamento (padrão já usado pelo webhook genérico). A função valida apenas que o `account_id` existe e que o payload tem o formato OLX.

**Vinculação de imóveis:** O campo `clientListingId` do OLX é o código do anúncio **do anunciante** (i.e., o código de referência que o corretor cadastrou no portal, que deve ser o mesmo `reference_code` cadastrado no imóvel no CRM). A Edge Function buscará por esse código na tabela `properties` do account.

**Normalização de temperatura:**
- `"Alta"` → `hot`
- `"Média"` → `warm`
- `"Baixa"` ou ausente → `cold`

**Normalização de leadType para campanha:**
- `CONTACT_CHAT` → "Chat"
- `CONTACT_FORM` → "Formulário"
- `CLICK_WHATSAPP` → "WhatsApp"
- `CLICK_SCHEDULE` → "Agendamento"
- `PHONE_VIEW` → "Visualização de Telefone"
- `VISIT_REQUEST` → "Solicitação de Visita"

---

### Arquivos a criar/modificar

1. **Criar** `supabase/functions/olx-webhook/index.ts` — nova Edge Function adaptadora
2. **Criar** `src/components/OlxIntegrationSettings.tsx` — componente de configuração UI
3. **Modificar** `src/pages/Settings.tsx` — adicionar aba "Grupo OLX"
4. **Modificar** `supabase/config.toml` — registrar nova função com `verify_jwt = false`
