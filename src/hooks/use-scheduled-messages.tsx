import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ScheduledMessage {
  scheduled_for: string;
  message: string;
  automation_rule_id: string | null;
  rule_name: string | null;
}

interface UseScheduledMessagesResult {
  nextMessage: ScheduledMessage | null;
  totalPending: number;
  loading: boolean;
}

/**
 * Hook to get scheduled (pending) WhatsApp messages for a single lead.
 */
export function useScheduledMessages(leadId: string | undefined): UseScheduledMessagesResult {
  const [nextMessage, setNextMessage] = useState<ScheduledMessage | null>(null);
  const [totalPending, setTotalPending] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leadId) {
      setNextMessage(null);
      setTotalPending(0);
      return;
    }

    setLoading(true);

    const fetch = async () => {
      const { data, error } = await supabase
        .from('whatsapp_message_queue')
        .select('scheduled_for, message, automation_rule_id, whatsapp_automation_rules(name)')
        .eq('lead_id', leadId)
        .eq('status', 'pending')
        .order('scheduled_for', { ascending: true });

      if (error || !data || data.length === 0) {
        setNextMessage(null);
        setTotalPending(0);
        setLoading(false);
        return;
      }

      const first = data[0];
      const ruleName = (first as any).whatsapp_automation_rules?.name ?? null;

      setNextMessage({
        scheduled_for: first.scheduled_for,
        message: first.message,
        automation_rule_id: first.automation_rule_id,
        rule_name: ruleName,
      });
      setTotalPending(data.length);
      setLoading(false);
    };

    fetch();
  }, [leadId]);

  return { nextMessage, totalPending, loading };
}

/**
 * Batch hook: returns a Map of lead_id -> { scheduledFor, totalPending }
 * for leads that have pending scheduled messages.
 */
export function useScheduledMessagesMap(leadIds: string[]) {
  const [map, setMap] = useState<Map<string, { scheduledFor: string; totalPending: number }>>(new Map());

  useEffect(() => {
    if (!leadIds.length) {
      setMap(new Map());
      return;
    }

    const fetchData = async () => {
      const { data } = await supabase
        .from('whatsapp_message_queue')
        .select('lead_id, scheduled_for')
        .in('lead_id', leadIds)
        .eq('status', 'pending')
        .order('scheduled_for', { ascending: true });

      if (data) {
        const result = new Map<string, { scheduledFor: string; totalPending: number }>();
        for (const row of data) {
          if (row.lead_id) {
            const existing = result.get(row.lead_id);
            if (existing) {
              existing.totalPending++;
            } else {
              result.set(row.lead_id, { scheduledFor: row.scheduled_for, totalPending: 1 });
            }
          }
        }
        setMap(result);
      }
    };

    fetchData();
  }, [leadIds.join(',')]);

  return map;
}

/**
 * Format a UTC date string to São Paulo timezone in pt-BR.
 */
export function formatScheduledTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}
