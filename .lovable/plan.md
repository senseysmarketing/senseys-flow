

## Corrigir event_id no Envio de Eventos Meta CAPI

### Problema Identificado

O `event_id` enviado para a Meta CAPI esta sendo gerado como um ID interno do CRM (`lead_id_eventName_timestamp`), em vez de usar o `meta_lead_id` original do formulario do Facebook. Isso impede que a Meta conecte estruturalmente o evento de qualificacao ao lead original do formulario, reduzindo a eficacia da otimizacao de campanhas.

### Status Atual (Nivel Intermediario)

```text
Codigo atual (linha 122):
  eventId = `${lead_id}_${event_name}_${timestamp}`
  
  -> Gera: "uuid-interno_Lead_1707480000"
  -> Meta NAO consegue vincular ao lead original do formulario
```

### Correcao (Nivel Avancado)

```text
Codigo corrigido:
  Se meta_lead_id existir:
    eventId = meta_lead_id   (ID original do formulario Meta)
  Senao:
    eventId = `${lead_id}_${event_name}_${timestamp}`  (fallback para leads sem meta_lead_id)
```

### O que sera alterado

**Arquivo: `supabase/functions/send-meta-event/index.ts`**

1. Alterar a logica de geracao do `event_id` (linha 120-122):
   - Usar `lead.meta_lead_id` como `event_id` quando disponivel
   - Manter o fallback atual para leads que nao vieram do Meta (webhook manual, importacao, etc.)
   - Adicionar log indicando qual tipo de event_id esta sendo usado

2. Manter `userData.lead_id = lead.meta_lead_id` como esta (matching de usuario continua funcionando)

### Resultado Esperado

O payload enviado para a Meta ficara assim:

```text
{
  "event_name": "Contact",
  "event_time": 1707480000,
  "event_id": "META_LEAD_ID_ORIGINAL",    <-- agora usa o ID do formulario
  "action_source": "system_generated",
  "user_data": {
    "lead_id": "META_LEAD_ID_ORIGINAL",   <-- matching de usuario (ja existia)
    "em": ["hash_sha256_email"],
    "ph": ["hash_sha256_phone"]
  },
  "custom_data": {
    "lead_event_source": "Senseys CRM",
    "content_name": "Apartamento Centro",
    "content_category": "Facebook"
  }
}
```

### Checklist de Conformidade

- [x] Hash SHA-256 de email e telefone
- [x] Envio rapido apos mudanca de status
- [Corrigir] event_id usando meta_lead_id do formulario
- [x] Mesmo pixel da campanha (via account_meta_config)
- [x] action_source: "system_generated"
- [x] user_data.lead_id para matching

### Detalhes Tecnicos

A alteracao e minima - apenas 5-6 linhas na edge function `send-meta-event/index.ts`. Nenhuma mudanca no banco de dados ou frontend e necessaria.

