

## Diagnostico: Leads do Meta Ads nao chegam para ANZ Imoveis

### Problemas Identificados

**1. Edge Function `meta-webhook` NAO esta deployada (CRITICO)**

O endpoint que recebe os webhooks do Facebook (`meta-webhook`) retorna erro 404 - ele nao esta deployado no Supabase. O arquivo existe no codigo (`supabase/functions/meta-webhook/index.ts`), mas nunca foi publicado. Isso significa que NENHUM lead do Meta Ads chega automaticamente para NENHUM cliente, nao apenas para ANZ Imoveis.

**2. Pagina sem App associado**

A screenshot mostra: "A Pagina selecionada nao tem nenhum app associado a ela." Isso significa que o Facebook nao sabe para onde enviar os eventos de leadgen desta pagina. O sistema tenta fazer essa associacao automaticamente quando a configuracao e salva (via `subscribed_apps`), mas sem o webhook deployado, o Facebook nao consegue validar a URL de callback.

**3. Possivel App em modo Development**

Se o App Meta estiver em modo "Development" (nao "Live"), webhooks so funcionam para administradores do App, nao para todas as paginas.

### Plano de Correcao

**Passo 1: Deploy do edge function `meta-webhook`**

Fazer o deploy da funcao que ja existe no codigo. Isso ativara o endpoint:
`https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/meta-webhook`

**Passo 2: Verificar configuracao do webhook no Meta App Dashboard**

Apos o deploy, e necessario que no Painel de Apps do Facebook (developers.facebook.com):
- O produto "Webhooks" esteja adicionado ao App
- O webhook para o objeto "Page" esteja configurado com a URL: `https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/meta-webhook`
- O campo "leadgen" esteja inscrito
- O Verify Token corresponda ao secret `META_WEBHOOK_VERIFY_TOKEN` configurado no projeto

**Passo 3: Re-inscrever a pagina ANZ Imoveis**

Apos o webhook estar ativo, re-salvar a configuracao da ANZ Imoveis no painel da agencia para disparar a chamada `subscribed_apps` novamente, associando o App a Pagina.

**Passo 4: Verificar modo do App**

No Painel de Apps do Facebook, garantir que o App esteja no modo "Live" (nao "Development"). Em modo Development, apenas administradores do App recebem webhooks.

### Acoes Manuais do Usuario (Facebook Developer Dashboard)

Essas acoes precisam ser feitas manualmente em developers.facebook.com:
1. Abra o App Meta no Painel de Apps
2. Va em **Webhooks** (menu lateral)
3. Selecione o objeto **Page**
4. Configure a Callback URL: `https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/meta-webhook`
5. Configure o Verify Token com o mesmo valor do secret `META_WEBHOOK_VERIFY_TOKEN`
6. Inscreva o campo **leadgen**
7. Verifique que o App esta no modo **Live**

### Secao Tecnica

O fluxo completo de recebimento de leads Meta e:

```text
Facebook Lead Ad Submit
  -> Facebook envia POST para meta-webhook (webhook configurado no App)
  -> meta-webhook busca dados do lead via Graph API
  -> Insere no banco (tabela leads)
  -> Realtime notifica o frontend
```

O ponto de falha atual e o primeiro passo: o Facebook nao tem para onde enviar porque:
- A function `meta-webhook` nao esta deployada (404)
- A Pagina ANZ Imoveis nao tem o App inscrito

A funcao `meta-accounts` ja possui logica (linhas 252-274) para inscrever a pagina automaticamente via `POST /{page_id}/subscribed_apps?subscribed_fields=leadgen`, mas isso so funciona se o webhook do App estiver configurado corretamente no Facebook Developer Dashboard primeiro.

### Resultado Esperado

Apos o deploy e configuracao:
- Leads de TODOS os clientes com Meta configurado passarao a chegar automaticamente
- A ferramenta de teste de leads do Facebook (na screenshot) devera funcionar
- Nao sera mais necessario importar leads manualmente via CSV

