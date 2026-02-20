
## Correção: Número de Telefone Não Atualiza Após Reconexão com Outro Número

### Causa Raiz

No arquivo `supabase/functions/whatsapp-connect/index.ts`, no `case 'status'`, há duas condições falhas que impedem a atualização do número de telefone:

**Problema 1 — Nunca busca o número atualizado na Evolution API:**
```typescript
let phoneNumber = session.phone_number
if (isConnected && !phoneNumber) {  // FALHA: só busca se o campo está VAZIO
  phoneNumber = await fetchPhoneNumber(instanceName)
}
```
Como o banco já tem o número antigo, `!phoneNumber` é `false` → nunca vai à Evolution API checar qual número está conectado agora.

**Problema 2 — Nunca atualiza o banco com o número:**
```typescript
if (newStatus !== session.status || (isConnected && !session.phone_number && phoneNumber)) {
  // FALHA: a segunda condição só salva se session.phone_number estava NULL
}
```
Mesmo que o número no banco seja diferente do atual, o banco nunca é atualizado.

**Confirmação no banco:** o registro atual mostra `phone_number: '+55 (16) 99421-3312'` — número antigo — enquanto a Evolution API já tem o novo número `+55 (16) 98105-7418`.

---

### Solução

Duas mudanças na edge function `whatsapp-connect/index.ts`, no `case 'status'`:

**1. Sempre buscar o número atual na Evolution API quando conectado**, não só quando o campo está vazio:

```typescript
// ANTES:
let phoneNumber = session.phone_number
if (isConnected && !phoneNumber) {
  phoneNumber = await fetchPhoneNumber(instanceName)
}

// DEPOIS:
let phoneNumber = session.phone_number
if (isConnected) {
  const freshPhone = await fetchPhoneNumber(instanceName)
  if (freshPhone) phoneNumber = freshPhone  // sempre usa o número atual da API
}
```

**2. Atualizar o banco quando o número for diferente do que está salvo** (além das condições já existentes):

```typescript
// ANTES:
if (newStatus !== session.status || (isConnected && !session.phone_number && phoneNumber)) {

// DEPOIS:
const phoneChanged = isConnected && phoneNumber && phoneNumber !== session.phone_number
if (newStatus !== session.status || phoneChanged) {
```

**3. No frontend (`WhatsAppIntegrationSettings.tsx`)**, a condição de atualizar o estado local com o número também precisa ser corrigida. Atualmente na linha 171:

```typescript
// ANTES:
} else if (response.data?.phoneNumber && !data.phone_number) {
  setSession(prev => prev ? { ...prev, phone_number: response.data.phoneNumber } : null);
}

// DEPOIS:
} else if (response.data?.phoneNumber && response.data.phoneNumber !== data.phone_number) {
  setSession(prev => prev ? { ...prev, phone_number: response.data.phoneNumber } : null);
}
```

---

### Arquivos a Modificar

1. **`supabase/functions/whatsapp-connect/index.ts`** — linhas 447-464: corrigir lógica de busca e persistência do número de telefone.

2. **`src/components/whatsapp/WhatsAppIntegrationSettings.tsx`** — linha 171: corrigir condição de atualização do estado local com o número.

---

### Resultado

- Quando o usuário acessa a página de Integrações, a função `status` é chamada automaticamente
- Agora ela sempre consulta a Evolution API para pegar o número atual
- Se o número retornado for diferente do banco, atualiza o banco E retorna o número correto
- O frontend exibe o número correto imediatamente
- A próxima verificação de status já persistirá o `+55 (16) 98105-7418` corretamente
