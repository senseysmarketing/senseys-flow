

## Correcao: Subscribe da pagina ANZ Imoveis no Meta App

### Problema encontrado nos logs

Os logs confirmam que:
- A config da ANZ Imoveis foi salva com sucesso (`Saving config for account 03219d26...` as 20:29:59)
- A pagina ANZ Imoveis (ID: `221484851232856`) existe na lista de paginas e tem page token
- **O log "Page subscription result" NUNCA aparece**, indicando que a chamada `subscribed_apps` nao completou

### Causa raiz

No codigo atual (`meta-accounts/index.ts`, linhas 240-270), apos salvar a config, o sistema:
1. Faz uma **segunda chamada** a `/me/accounts` para buscar o page token (desnecessaria, pois ja tem essa info)
2. Faz o POST para `subscribed_apps`
3. Tudo dentro de um `try/catch` que engole erros silenciosamente

A Edge Function pode estar encerrando (shutdown) antes dessas chamadas extras completarem, ou um erro esta sendo engolido pelo catch vazio.

### Plano de correcao

**1. Melhorar logging no bloco de subscribe**

Adicionar logs detalhados em cada etapa do subscribe para identificar exatamente onde falha:
- Log antes de buscar o page token
- Log se o page token foi encontrado ou nao
- Log do resultado do subscribe (sucesso ou erro)
- Log no catch com o erro completo

**2. Otimizar a chamada de subscribe**

Em vez de fazer uma segunda chamada a `/me/accounts` para buscar o page token, reutilizar o token que ja foi obtido anteriormente no fluxo de forms. Isso reduz a latencia e o risco de timeout.

**3. Garantir que o subscribe complete antes de responder**

Mover o `await` do subscribe para ANTES de enviar a resposta ao cliente, garantindo que a Edge Function nao encerre prematuramente.

### Secao tecnica

Alteracoes no arquivo `supabase/functions/meta-accounts/index.ts`:

No bloco `save-config` (a partir da linha ~240), substituir:

```typescript
// Subscribe page to webhook if page_id is provided
if (page_id) {
  try {
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=id,access_token&access_token=${accessToken}`
    );
    const pagesData = await pagesResponse.json();
    const pageToken = pagesData.data?.find((p: any) => p.id === page_id)?.access_token;

    if (pageToken) {
      const subscribeResponse = await fetch(
        `https://graph.facebook.com/v19.0/${page_id}/subscribed_apps?subscribed_fields=leadgen&access_token=${pageToken}`,
        { method: 'POST' }
      );
      const subscribeData = await subscribeResponse.json();
      console.log('Page subscription result:', subscribeData);
    }
  } catch (e) {
    console.error('Error subscribing page:', e);
  }
}
```

Por uma versao com logging detalhado e subscribe executado ANTES da resposta:

```typescript
let subscribeResult = null;
if (page_id) {
  try {
    console.log(`Subscribing page ${page_id} to leadgen webhooks...`);
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=id,access_token&access_token=${accessToken}`
    );
    const pagesData = await pagesResponse.json();
    const pageToken = pagesData.data?.find((p: any) => p.id === page_id)?.access_token;

    if (pageToken) {
      console.log(`Found page token for page ${page_id}, sending subscribed_apps...`);
      const subscribeResponse = await fetch(
        `https://graph.facebook.com/v19.0/${page_id}/subscribed_apps?subscribed_fields=leadgen&access_token=${pageToken}`,
        { method: 'POST' }
      );
      const subscribeData = await subscribeResponse.json();
      subscribeResult = subscribeData;
      console.log('Page subscription result:', JSON.stringify(subscribeData));
    } else {
      console.error(`Page token NOT FOUND for page ${page_id}. Available pages: ${pagesData.data?.map((p: any) => p.id).join(', ')}`);
    }
  } catch (e) {
    console.error('Error subscribing page:', e.message, e.stack);
  }
}

return new Response(JSON.stringify({ success: true, config: data, subscribeResult }), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
```

### Resultado esperado

Apos esta correcao:
- Os logs mostrarao exatamente o que acontece no subscribe (sucesso ou erro detalhado)
- O subscribe completara antes da funcao encerrar
- O resultado do subscribe sera retornado ao frontend para feedback visual
- Ao re-salvar a config da ANZ Imoveis, veremos nos logs se o Facebook aceitou a inscricao

