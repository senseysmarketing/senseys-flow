
## Ajuste Visual: Padronização de Alturas dos Botões na Sequência

### Problema Identificado

Na seção de Saudação Automática (bloco da sequência), há 4 elementos em linha com alturas inconsistentes:

| Elemento | Classe atual | Altura real |
|---|---|---|
| "Editar/Configurar Sequência" | `size="sm"` sem override | h-9 (36px) |
| Badge "✓ Sequência ativa" | padrão Badge | ~22px |
| Botão "Desativar" | `size="sm" className="h-7 text-xs"` | h-7 (28px) |
| Botão lixeira | `size="icon" className="h-7 w-7"` | h-7 (28px) |

O padrão de referência (botões "Reconfigurar Webhook", "Reiniciar Instância", "Desconectar") usa `size="sm"` sem override, que resulta em h-9 (36px).

### Solução

Padronizar todos os elementos do bloco de sequência para `h-8` (32px) — um meio-termo visual entre os botões principais e o badge, mantendo harmonia sem parecer excessivamente grande:

- **"Editar/Configurar Sequência"**: adicionar `className="h-8 text-xs px-3"` para override do `size="sm"` padrão
- **Badge "✓ Sequência ativa"**: mudar para usar `Button asChild` não — em vez disso, aplicar `className="... h-8 rounded-md px-3 text-xs"` no Badge para forçar a mesma altura
- **Botão "Desativar"**: mudar de `h-7` para `h-8 text-xs px-3`
- **Botão lixeira**: mudar de `h-7 w-7` para `h-8 w-8`

O mesmo padrão será aplicado tanto no bloco de fallback (newLeadRule, linhas ~601–641) quanto no bloco de regras condicionais (linhas ~754–780).

### Arquivo a modificar

**`src/components/whatsapp/WhatsAppIntegrationSettings.tsx`** — dois blocos:
1. Linhas ~601–641: bloco de sequência do fallback rule
2. Linhas ~754–780: bloco de sequência das regras condicionais
