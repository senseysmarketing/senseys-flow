import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ScheduledMessage {
  scheduled_for: string;
  message: string;
  automation_rule_id: string | null;
  rule_name: string | null;
  phase: string;
}

interface UseScheduledMessagesResult {
  nextMessage: ScheduledMessage | null;
  totalPending: number;
  loading: boolean;
}

/**
 * Hook to get scheduled (pending) WhatsApp automation for a single lead.
 * Reads from whatsapp_automation_control (new state machine).
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

    const fetchData = async () => {
      // Check new automation control table
      const { data: controlRecords } = await supabase
        .from('whatsapp_automation_control')
        .select('next_execution_at, current_phase, automation_rule_id, steps_snapshot, current_step_position, whatsapp_automation_rules(name)')
        .eq('lead_id', leadId)
        .in('status', ['active', 'processing'])
        .order('next_execution_at', { ascending: true });

      if (controlRecords && controlRecords.length > 0) {
        const first = controlRecords[0];
        const snapshot = (first.steps_snapshot as any) || {};
        const phase = first.current_phase;
        const stepPos = first.current_step_position;
        const steps = phase === 'followup' ? (snapshot.followup || []) : (snapshot.greeting || []);
        const currentStep = steps[stepPos];
        const ruleName = (first as any).whatsapp_automation_rules?.name ?? null;

        // Count remaining steps across all phases
        const greetingRemaining = Math.max(0, (snapshot.greeting?.length || 0) - (phase === 'greeting' ? stepPos : snapshot.greeting?.length || 0));
        const followupRemaining = Math.max(0, (snapshot.followup?.length || 0) - (phase === 'followup' ? stepPos : 0));
        const total = greetingRemaining + followupRemaining;

        setNextMessage({
          scheduled_for: first.next_execution_at || '',
          message: currentStep?.template_content || `Etapa ${phase} #${stepPos + 1}`,
          automation_rule_id: first.automation_rule_id,
          rule_name: ruleName,
          phase: phase,
        });
        setTotalPending(total);
        setLoading(false);
        return;
      }

      // Fallback: check legacy queue
      const { data: legacyData } = await supabase
        .from('whatsapp_message_queue')
        .select('scheduled_for, message, automation_rule_id, whatsapp_automation_rules(name)')
        .eq('lead_id', leadId)
        .eq('status', 'pending')
        .order('scheduled_for', { ascending: true });

      if (legacyData && legacyData.length > 0) {
        const first = legacyData[0];
        const ruleName = (first as any).whatsapp_automation_rules?.name ?? null;

        setNextMessage({
          scheduled_for: first.scheduled_for,
          message: first.message,
          automation_rule_id: first.automation_rule_id,
          rule_name: ruleName,
          phase: 'legacy',
        });
        setTotalPending(legacyData.length);
      } else {
        setNextMessage(null);
        setTotalPending(0);
      }
      setLoading(false);
    };

    fetchData();
  }, [leadId]);

  return { nextMessage, totalPending, loading };
}

/**
 * Batch hook: returns a Map of lead_id -> { scheduledFor, totalPending }
 * for leads that have pending scheduled messages (automation control + legacy).
 */
export function useScheduledMessagesMap(leadIds: string[]) {
  const [map, setMap] = useState<Map<string, { scheduledFor: string; totalPending: number }>>(new Map());

  useEffect(() => {
    if (!leadIds.length) {
      setMap(new Map());
      return;
    }

    const fetchData = async () => {
      const result = new Map<string, { scheduledFor: string; totalPending: number }>();

      // Check new automation control table
      const { data: controlData } = await supabase
        .from('whatsapp_automation_control')
        .select('lead_id, next_execution_at')
        .in('lead_id', leadIds)
        .in('status', ['active', 'processing'])
        .order('next_execution_at', { ascending: true });

      if (controlData) {
        for (const row of controlData) {
          if (row.lead_id) {
            const existing = result.get(row.lead_id);
            if (existing) {
              existing.totalPending++;
            } else {
              result.set(row.lead_id, { scheduledFor: row.next_execution_at || '', totalPending: 1 });
            }
          }
        }
      }

      // Also check legacy queue for leads not already found
      const missingLeadIds = leadIds.filter(id => !result.has(id));
      if (missingLeadIds.length > 0) {
        const { data: legacyData } = await supabase
          .from('whatsapp_message_queue')
          .select('lead_id, scheduled_for')
          .in('lead_id', missingLeadIds)
          .eq('status', 'pending')
          .order('scheduled_for', { ascending: true });

        if (legacyData) {
          for (const row of legacyData) {
            if (row.lead_id) {
              const existing = result.get(row.lead_id);
              if (existing) {
                existing.totalPending++;
              } else {
                result.set(row.lead_id, { scheduledFor: row.scheduled_for, totalPending: 1 });
              }
            }
          }
        }
      }

      setMap(result);
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
