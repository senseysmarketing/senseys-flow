

## Ajuste visual: informacoes de conexao WhatsApp

### O que muda

Na secao de status do WhatsApp conectado, o numero e a data de conexao estao na mesma linha (`flex items-center justify-between`) que os botoes de acao, causando quebra visual em telas menores.

A correcao separa as informacoes em duas linhas:
- **Linha 1**: Numero do telefone
- **Linha 2**: "Conectado desde: 12/02/2026"

E muda o layout do container de `flex items-center justify-between` para `flex flex-col gap-3`, com os botoes em uma segunda linha.

### Secao tecnica

**Arquivo: `src/components/whatsapp/WhatsAppIntegrationSettings.tsx`** (linhas 519-527)

Alterar o bloco de informacoes de conexao:

```typescript
// ANTES (linha 519-527):
<div className="flex items-center justify-between">
  <div className="text-sm text-muted-foreground">
    {session?.phone_number && <span>Número: {session.phone_number}</span>}
    {session?.connected_at && (
      <span className="ml-4">
        Conectado desde: {new Date(session.connected_at).toLocaleDateString('pt-BR')}
      </span>
    )}
  </div>

// DEPOIS:
<div className="space-y-3">
  <div className="flex flex-col text-sm text-muted-foreground">
    {session?.phone_number && <span>Número: {session.phone_number}</span>}
    {session?.connected_at && (
      <span>
        Conectado desde: {new Date(session.connected_at).toLocaleDateString('pt-BR')}
      </span>
    )}
  </div>
```

O container principal muda de `flex items-center justify-between` para `space-y-3`, e os botoes ficam em uma linha separada abaixo das informacoes, com `flex items-center gap-2 flex-wrap`.

