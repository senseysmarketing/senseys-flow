

## Correcao: Regras de distribuicao e notificacoes nao funcionam

### Problema identificado

Investigando a conta ANZ Imoveis, todos os 10 leads mais recentes estao com `assigned_broker_id = null`. Isso ocorre por dois problemas distintos:

**Problema 1 - Distribuicao nunca e chamada para leads manuais:**
O codigo de criacao manual de leads em `Leads.tsx` chama `notify-new-lead` mas **nunca chama `apply-distribution-rules`**. Portanto, leads criados manualmente nunca sao atribuidos a nenhum corretor.

**Problema 2 - Distribuicao falha silenciosamente para leads Meta:**
A funcao `apply-distribution-rules` **nao esta listada no `config.toml`**, o que significa que ela usa `verify_jwt = true` por padrao. Quando o `meta-webhook` tenta invoca-la, pode haver falha de autenticacao. Alem disso, o erro e engolido por um `try {} catch {}` vazio, sem nenhum log.

**Consequencia:** Como nenhum lead e atribuido a um corretor, e as notificacoes foram configuradas para disparar apenas para o corretor atribuido, ninguem recebe notificacao.

### Solucao

Corrigir os tres pontos de falha:

1. Adicionar `apply-distribution-rules` ao `config.toml` com `verify_jwt = false` (pois e chamada internamente por outras edge functions)
2. Adicionar chamada a `apply-distribution-rules` na criacao manual de leads em `Leads.tsx`, antes de chamar `notify-new-lead`
3. Adicionar logs de erro no `meta-webhook` para que falhas na distribuicao nao sejam mais silenciosas
4. Passar o `assigned_broker_id` resultante da distribuicao para o `notify-new-lead` na criacao manual

### Secao tecnica

**Arquivo: `supabase/config.toml`**

Adicionar entrada para `apply-distribution-rules`:

```toml
[functions.apply-distribution-rules]
verify_jwt = false
```

**Arquivo: `src/pages/Leads.tsx`**

Apos a insercao do lead (linha ~335) e antes da chamada a `notify-new-lead`, adicionar chamada a distribuicao:

```typescript
if (error) throw error;

// Apply distribution rules to assign broker
let assignedBrokerId: string | undefined;
try {
  const distResult = await supabase.functions.invoke('apply-distribution-rules', {
    body: {
      lead_id: insertedLead.id,
      account_id: profile.account_id,
    }
  });
  if (distResult.data?.success) {
    assignedBrokerId = distResult.data.broker_id;
    console.log(`Lead assigned to broker: ${distResult.data.broker_name}`);
  }
} catch (distError) {
  console.error('Distribution error:', distError);
}

// Send notification (with assigned broker if distribution worked)
try {
  await supabase.functions.invoke('notify-new-lead', {
    body: {
      lead_id: insertedLead.id,
      lead_name: newLead.name,
      lead_phone: newLead.phone,
      lead_email: newLead.email,
      lead_temperature: newLead.temperature || 'cold',
      lead_origem: newLead.origem || 'Manual',
      property_name: null,
      account_id: profile.account_id,
      assigned_broker_id: assignedBrokerId,  // Passa o broker atribuido
    }
  });
} catch (notifyError) {
  console.error('Notification error:', notifyError);
}
```

**Arquivo: `supabase/functions/meta-webhook/index.ts`**

Substituir o `try {} catch {}` vazio (linhas 201-206) por logging adequado:

```typescript
// Distribution rules
let brokerId: string | undefined;
try {
  const dist = await supabase.functions.invoke("apply-distribution-rules", { 
    body: { lead_id: newLead.id, account_id: cfg.account_id } 
  });
  console.log("Distribution result:", JSON.stringify(dist.data));
  if (dist.data?.success) brokerId = dist.data.broker_id;
  else console.log("Distribution did not assign:", dist.data?.reason);
} catch (distErr) {
  console.error("Distribution error:", distErr);
}
```

### Resultado esperado

1. A funcao `apply-distribution-rules` sera acessivel sem JWT (necessario para chamadas internas entre edge functions)
2. Leads criados manualmente passarao pela distribuicao automatica antes da notificacao
3. O Bruno (unico membro da ANZ Imoveis) sera atribuido automaticamente a todos os leads via Round Robin
4. Com o `assigned_broker_id` preenchido, as notificacoes push e email serao disparadas corretamente para ele
5. Erros de distribuicao serao registrados nos logs para facilitar debug futuro
