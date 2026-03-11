import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WhatsAppFailure {
  lead_id: string;
  error_message: string | null;
}

/** Normaliza mensagens de erro do WhatsApp para português amigável */
function normalizeWhatsAppError(msg: string | null): string {
  if (!msg) return 'Falha no envio';
  const lower = msg.toLowerCase();
  if (
    lower.includes('não possui whatsapp') ||
    lower.includes('numero nao possui') ||
    lower.includes('não existe no whatsapp') ||
    lower.includes('failed to send') ||
    lower.includes('not exist') ||
    lower.includes('not registered') ||
    lower.includes('not on whatsapp') ||
    lower.includes('invalid number') ||
    lower.includes('numero invalido')
  ) {
    return 'Este número não existe no WhatsApp';
  }
  return msg;
}

/**
 * Hook to check if the WhatsApp session is connected for the current account.
 */
export function useWhatsAppConnected(accountId?: string) {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    if (!accountId) {
      setIsConnected(null);
      return;
    }

    const check = async () => {
      const { data: session } = await supabase
        .from('whatsapp_sessions')
        .select('status')
        .eq('account_id', accountId)
        .maybeSingle();

      if (!session) {
        setIsConnected(false);
        return;
      }

      if (session.status === 'connected') {
        setIsConnected(true);
        return;
      }

      // DB says not connected — verify with Evolution API to avoid stale status
      try {
        const response = await supabase.functions.invoke('whatsapp-connect?action=status');
        if (!response.error && response.data?.connected) {
          setIsConnected(true);
          return;
        }
      } catch {
        // fall through
      }
      setIsConnected(false);
    };

    check();
  }, [accountId]);

  return isConnected;
}

/**
 * Hook to check if specific leads have failed WhatsApp messages.
 * Returns a Map of lead_id -> error_message for leads with failures.
 */
export function useWhatsAppFailures(leadIds: string[]) {
  const [failures, setFailures] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!leadIds.length) {
      setFailures(new Map());
      return;
    }

    const fetchFailures = async () => {
      const [queueResult, logResult] = await Promise.all([
        supabase
          .from('whatsapp_message_queue')
          .select('lead_id, error_message')
          .in('lead_id', leadIds)
          .eq('status', 'failed')
          .order('created_at', { ascending: false }),
        supabase
          .from('whatsapp_message_log')
          .select('lead_id, delivery_status')
          .in('lead_id', leadIds)
          .eq('delivery_status', 'failed')
          .order('sent_at', { ascending: false }),
      ]);

      const map = new Map<string, string>();
      if (queueResult.data) {
        for (const row of queueResult.data) {
          if (row.lead_id && !map.has(row.lead_id)) {
            map.set(row.lead_id, normalizeWhatsAppError(row.error_message));
          }
        }
      }
      if (logResult.data) {
        for (const row of logResult.data) {
          if (row.lead_id && !map.has(row.lead_id)) {
            map.set(row.lead_id, 'Falha no envio da mensagem');
          }
        }
      }
      setFailures(map);
    };

    fetchFailures();
  }, [leadIds.join(',')]);

  return failures;
}

/**
 * Hook to check if a single lead has failed WhatsApp messages.
 * Also checks if WhatsApp is currently disconnected to differentiate alerts.
 */
export function useLeadWhatsAppFailure(leadId: string | undefined, accountId?: string) {
  const [failure, setFailure] = useState<string | null>(null);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leadId) {
      setFailure(null);
      setIsDisconnected(false);
      return;
    }

    setLoading(true);

    const fetchData = async () => {
      // Run all queries in parallel
      const [queueResult, logResult, sessionResult] = await Promise.all([
        supabase
          .from('whatsapp_message_queue')
          .select('error_message')
          .eq('lead_id', leadId)
          .eq('status', 'failed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('whatsapp_message_log')
          .select('delivery_status')
          .eq('lead_id', leadId)
          .eq('delivery_status', 'failed')
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        accountId
          ? supabase
              .from('whatsapp_sessions')
              .select('status')
              .eq('account_id', accountId)
              .eq('status', 'connected')
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const hasFailed = !!queueResult.data || !!logResult.data;
      const isConnected = !!sessionResult.data;
      const errorMsg = queueResult.data?.error_message || (logResult.data ? 'Falha no envio da mensagem' : null);

      if (hasFailed && !isConnected) {
        setFailure(null);
        setIsDisconnected(true);
      } else if (hasFailed && isConnected) {
        setFailure(normalizeWhatsAppError(errorMsg));
        setIsDisconnected(false);
      } else {
        setFailure(null);
        setIsDisconnected(false);
      }

      setLoading(false);
    };

    fetchData();
  }, [leadId, accountId]);

  return { failure, isDisconnected, loading };
}
