import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WhatsAppFailure {
  lead_id: string;
  error_message: string | null;
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
      const { data } = await supabase
        .from('whatsapp_message_queue')
        .select('lead_id, error_message')
        .in('lead_id', leadIds)
        .eq('status', 'failed')
        .order('created_at', { ascending: false });

      if (data) {
        const map = new Map<string, string>();
        for (const row of data) {
          if (row.lead_id && !map.has(row.lead_id)) {
            map.set(row.lead_id, row.error_message || 'Falha no envio');
          }
        }
        setFailures(map);
      }
    };

    fetchFailures();
  }, [leadIds.join(',')]);

  return failures;
}

/**
 * Hook to check if a single lead has failed WhatsApp messages.
 */
export function useLeadWhatsAppFailure(leadId: string | undefined) {
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leadId) {
      setFailure(null);
      return;
    }

    setLoading(true);
    supabase
      .from('whatsapp_message_queue')
      .select('error_message')
      .eq('lead_id', leadId)
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setFailure(data?.error_message || null);
        setLoading(false);
      });
  }, [leadId]);

  return { failure, loading };
}
