
Objetivo: eliminar falso “Desconectado” para WhatsApp (caso Braz Imóveis) mesmo quando a instância está aberta na Evolution, e impedir recorrência.

Diagnóstico confirmado
- A sessão da conta `7629c620-65a5-4e89-afbf-599cd221db5d` está no banco como `connecting` (updated_at antigo), mas há mensagens recentes trafegando normalmente, o que comprova conexão real ativa.
- Na tela de Integrações, `fetchSession()` só chama `whatsapp-connect?action=status` quando o banco já está `connected`. Se estiver `connecting`/`disconnected`, não há reconciliação com a Evolution.
- Resultado: status stale no banco vira “verdade” na UI e o CRM mostra desconectado incorretamente.

Plano de correção (em camadas)

1) Correção imediata da tela crítica (Integrações)
Arquivo:
- `src/components/whatsapp/WhatsAppIntegrationSettings.tsx`

Mudanças:
- Ajustar `fetchSession()` para revalidar status real via `whatsapp-connect?action=status` sempre que existir sessão (não apenas quando `data.status === 'connected'`).
- Reconciliar estado local com retorno da function:
  - Se `connected=true`: forçar `session.status='connected'` e sincronizar `phone_number` quando vier da API.
  - Se `connected=false`: manter `disconnected`.
- Manter fallback de `auth.refreshSession()` em 401, mas sem toast destrutivo indevido em casos transitórios.
- Mostrar toast de desconexão apenas em transição real de conectado -> desconectado (evitar alarmes falsos).

2) Blindagem para não voltar a ficar stale (backend)
Arquivo:
- `supabase/functions/whatsapp-webhook/index.ts`

Mudanças:
- Em `handleConnectionUpdate`, tratar `state='connecting'` como transitório:
  - Antes de rebaixar status de sessão já conectada, confirmar estado real na Evolution (`connectionState`).
  - Só persistir `connecting/disconnected` quando houver confirmação.
- Em `handleMessagesUpsert`, se chegar tráfego e sessão não estiver `connected`, auto-sincronizar para `connected` (com `updated_at` e preservando `connected_at`), pois tráfego é evidência de sessão ativa.
- Adicionar logs de transição com `instance`, `status antigo`, `status novo`, para auditoria.

3) Aplicar a mesma lógica nos outros pontos de UI que hoje confiam só no banco
Arquivos:
- `src/components/leads/WhatsAppChatModal.tsx`
- `src/hooks/use-conversations.tsx`
- `src/pages/Leads.tsx`
- `src/hooks/use-whatsapp-failures.tsx`

Mudanças:
- Onde hoje faz `.eq('status','connected')` direto, incluir fallback de verificação real via `whatsapp-connect?action=status` quando vier `connecting/disconnected`.
- Evitar bloquear fluxo (chat, automações manuais, indicadores de falha) por status stale.

4) Padronização para manutenção (evitar regressão)
Arquivos:
- Novo hook utilitário (ex.: `src/hooks/use-whatsapp-connection-status.ts`) ou helper em `src/lib/`
- Reuso nos arquivos acima

Mudanças:
- Centralizar função de “status verificado” para não duplicar lógica de refresh token + invoke + reconciliação.
- Reduzir chamadas desnecessárias (só acionar fallback quando status local não for confiável).

Validação (obrigatória)
1. Abrir `/integrations` na conta Braz com sessão no banco em `connecting` e instância aberta na Evolution:
   - Esperado: UI corrigir para “Conectado” automaticamente.
2. Validar rota de Conversas:
   - Esperado: não esconder conversas por falso desconectado.
3. Validar criação de lead manual com automação ativa:
   - Esperado: não bloquear envio por status stale.
4. Testar cenário realmente desconectado:
   - Esperado: continuar mostrando “Desconectado” corretamente.
5. Conferir logs da `whatsapp-webhook` para garantir transições coerentes e sem flapping.

Ordem de execução recomendada
1. Ajuste imediato em `WhatsAppIntegrationSettings.tsx`.
2. Hardening em `whatsapp-webhook` e deploy da function.
3. Propagação para Chat/Conversations/Leads/hooks.
4. Validação end-to-end completa em conta de suporte (Braz) e ao menos outra conta ativa.
