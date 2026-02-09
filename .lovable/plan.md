

## Corrigir Push Notification - Erro de Tipo no Payload FCM

### Problema Encontrado

O lead **Jaime Santos** chegou e o push foi disparado para os 2 dispositivos do usuario "Thiago e Belisa", porem **ambos falharam** com o erro:

```
Invalid value at 'message.data[1].value' (TYPE_STRING), true
```

A API FCM v1 exige que **todos os valores** dentro do objeto `data` sejam **strings**. No arquivo `notify-new-lead/index.ts`, linha 261, o campo `assigned` e enviado como `boolean`:

```typescript
data: { lead_id, assigned: isDirectedNotification }
//                         ^^^^^^^^^^^^^^^^^^^^^^ boolean (true/false)
```

### Solucao

Converter o valor para string antes de enviar.

### Arquivo a Modificar

**`supabase/functions/notify-new-lead/index.ts`** (linha 261)

### Mudanca

Substituir:
```typescript
data: { lead_id, assigned: isDirectedNotification }
```

Por:
```typescript
data: { lead_id, assigned: String(isDirectedNotification) }
```

Isso garante que o valor enviado seja `"true"` ou `"false"` (string), atendendo a exigencia da API FCM v1. Os 2 dispositivos do usuario passarao a receber as notificacoes corretamente.
