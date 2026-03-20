import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const MAX_LEADS_PER_ACCOUNT = 50;
const CHUNK_SIZE = 5;
const AI_TIMEOUT_MS = 15000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // 1. Get accounts with AI funnel enabled
    const { data: accounts, error: accErr } = await supabase
      .from("accounts")
      .select("id, last_ai_funnel_run_at")
      .eq("ai_funnel_enabled", true);

    if (accErr) throw accErr;
    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ message: "No accounts with AI funnel enabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const account of accounts) {
      try {
        const accountResult = await processAccount(supabase, account);
        results.push(accountResult);
      } catch (err) {
        console.error(`Error processing account ${account.id}:`, err);
        results.push({ account_id: account.id, error: String(err) });
      }
    }

    // Update last_ai_funnel_run_at for all processed accounts
    const now = new Date().toISOString();
    for (const account of accounts) {
      await supabase
        .from("accounts")
        .update({ last_ai_funnel_run_at: now })
        .eq("id", account.id);
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-funnel-advance error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processAccount(supabase: any, account: { id: string; last_ai_funnel_run_at: string | null }) {
  const accountId = account.id;
  const since = account.last_ai_funnel_run_at || new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  // Get all statuses for this account, ordered by position
  const { data: statuses, error: statusErr } = await supabase
    .from("lead_status")
    .select("id, name, position")
    .eq("account_id", accountId)
    .order("position", { ascending: true });

  if (statusErr) throw statusErr;
  if (!statuses || statuses.length === 0) return { account_id: accountId, message: "No statuses" };

  // Identify intermediate status IDs (position 1-5, excluding first and last two typically)
  // We process leads in statuses between "Novo Lead" (pos 0) and "Fechado"/"Perdido" (last positions)
  const maxPos = Math.max(...statuses.map((s: any) => s.position));
  const intermediateStatuses = statuses.filter((s: any) => s.position >= 1 && s.position <= maxPos - 2);
  
  if (intermediateStatuses.length === 0) return { account_id: accountId, message: "No intermediate statuses" };

  const intermediateStatusIds = intermediateStatuses.map((s: any) => s.id);

  // Find leads in intermediate statuses that have new incoming messages since last run
  const { data: leadsWithNewMessages, error: leadsErr } = await supabase
    .from("whatsapp_messages")
    .select("lead_id")
    .eq("account_id", accountId)
    .eq("is_from_me", false)
    .gt("timestamp", since)
    .not("lead_id", "is", null);

  if (leadsErr) throw leadsErr;
  if (!leadsWithNewMessages || leadsWithNewMessages.length === 0) {
    return { account_id: accountId, message: "No new messages since last run" };
  }

  const leadIdsWithMessages = [...new Set(leadsWithNewMessages.map((m: any) => m.lead_id))];

  // Get leads that are in intermediate statuses AND have new messages
  const { data: leads, error: leadsFilterErr } = await supabase
    .from("leads")
    .select("id, name, phone, status_id")
    .eq("account_id", accountId)
    .in("status_id", intermediateStatusIds)
    .in("id", leadIdsWithMessages)
    .limit(MAX_LEADS_PER_ACCOUNT);

  if (leadsFilterErr) throw leadsFilterErr;
  if (!leads || leads.length === 0) {
    return { account_id: accountId, message: "No qualifying leads" };
  }

  // Process leads in chunks of CHUNK_SIZE
  const chunks: any[][] = [];
  for (let i = 0; i < leads.length; i += CHUNK_SIZE) {
    chunks.push(leads.slice(i, i + CHUNK_SIZE));
  }

  let processed = 0;
  let advanced = 0;

  for (const chunk of chunks) {
    const promises = chunk.map((lead: any) =>
      processLead(supabase, accountId, lead, statuses).catch(err => {
        console.error(`Error processing lead ${lead.id}:`, err);
        return null;
      })
    );
    const results = await Promise.all(promises);
    
    for (const r of results) {
      if (r) {
        processed++;
        if (r.advanced) advanced++;
      }
    }
  }

  return { account_id: accountId, processed, advanced };
}

async function processLead(
  supabase: any,
  accountId: string,
  lead: { id: string; name: string; phone: string; status_id: string },
  statuses: Array<{ id: string; name: string; position: number }>
) {
  // Get last 30 messages for this lead
  const { data: messages, error: msgErr } = await supabase
    .from("whatsapp_messages")
    .select("content, is_from_me, timestamp")
    .eq("account_id", accountId)
    .eq("lead_id", lead.id)
    .not("content", "is", null)
    .order("timestamp", { ascending: true })
    .limit(30);

  if (msgErr) throw msgErr;
  if (!messages || messages.length < 2) return { advanced: false };

  const currentStatus = statuses.find(s => s.id === lead.status_id);
  if (!currentStatus) return { advanced: false };

  // Build conversation text
  const conversationText = messages
    .map((m: any) => `[${m.is_from_me ? "Corretor" : "Lead"}] ${m.content}`)
    .join("\n");

  // Only allow advancement to statuses with higher position
  const advanceableStatuses = statuses
    .filter(s => s.position > currentStatus.position)
    .map(s => ({ id: s.id, name: s.name, position: s.position }));

  if (advanceableStatuses.length === 0) return { advanced: false };

  const systemPrompt = `Você é um assistente de CRM imobiliário. Analise a conversa abaixo entre corretor e lead.

O lead "${lead.name}" está atualmente na etapa: "${currentStatus.name}" (posição ${currentStatus.position}).

Os status disponíveis para avanço são (em ordem):
${JSON.stringify(advanceableStatuses)}

Com base nas mensagens, identifique se houve avanço na negociação.

REGRAS:
- Só avance se houver evidência CLARA na conversa
- "Visita Agendada" requer data/horário de visita combinada
- "Proposta" requer discussão de valores ou condições
- "Negociação" requer contraproposta ou negociação ativa de termos
- "Fechado" requer confirmação explícita de acordo/venda
- "Perdido" se o lead expressou desinteresse claro ou pediu para parar
- Se não houver mudança significativa, retorne null como new_status_id
- Seja CONSERVADOR: na dúvida, não avance`;

  const userPrompt = `Conversa:\n${conversationText}`;

  // Call AI with tool calling
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_lead_status",
              description: "Classifica o status do lead com base na conversa analisada",
              parameters: {
                type: "object",
                properties: {
                  new_status_id: {
                    type: "string",
                    description: "UUID do novo status para avançar, ou 'null' se não houver mudança",
                  },
                  reason: {
                    type: "string",
                    description: "Resumo de 1 linha do motivo da classificação",
                  },
                },
                required: ["new_status_id", "reason"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_lead_status" } },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`AI error for lead ${lead.id}: ${aiResponse.status} ${errText}`);
      
      // Log error
      await supabase.from("ai_funnel_logs").insert({
        account_id: accountId,
        lead_id: lead.id,
        previous_status_id: lead.status_id,
        ai_summary: `Erro na API: ${aiResponse.status}`,
        action_taken: "error",
        messages_analyzed: messages.length,
      });
      
      return { advanced: false };
    }

    const aiData = await aiResponse.json();
    
    // Extract tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      await supabase.from("ai_funnel_logs").insert({
        account_id: accountId,
        lead_id: lead.id,
        previous_status_id: lead.status_id,
        ai_summary: "IA não retornou tool call",
        action_taken: "error",
        messages_analyzed: messages.length,
      });
      return { advanced: false };
    }

    const args = JSON.parse(toolCall.function.arguments);
    const newStatusId = args.new_status_id;
    const reason = args.reason || "Sem motivo especificado";

    // If no change
    if (!newStatusId || newStatusId === "null" || newStatusId === lead.status_id) {
      await supabase.from("ai_funnel_logs").insert({
        account_id: accountId,
        lead_id: lead.id,
        previous_status_id: lead.status_id,
        ai_summary: reason,
        action_taken: "no_change",
        messages_analyzed: messages.length,
      });
      return { advanced: false };
    }

    // Validate: new status must exist in account and have higher position
    const newStatus = statuses.find(s => s.id === newStatusId);
    if (!newStatus || newStatus.position <= currentStatus.position) {
      await supabase.from("ai_funnel_logs").insert({
        account_id: accountId,
        lead_id: lead.id,
        previous_status_id: lead.status_id,
        ai_summary: `Status inválido retornado: ${newStatusId} - ${reason}`,
        action_taken: "error",
        messages_analyzed: messages.length,
      });
      return { advanced: false };
    }

    // Update lead status
    const { error: updateErr } = await supabase
      .from("leads")
      .update({ status_id: newStatusId })
      .eq("id", lead.id);

    if (updateErr) {
      console.error(`Failed to update lead ${lead.id}:`, updateErr);
      return { advanced: false };
    }

    // Log in ai_funnel_logs
    await supabase.from("ai_funnel_logs").insert({
      account_id: accountId,
      lead_id: lead.id,
      previous_status_id: lead.status_id,
      new_status_id: newStatusId,
      ai_summary: reason,
      action_taken: "advanced",
      messages_analyzed: messages.length,
    });

    // Log in lead_activities (timeline)
    await supabase.from("lead_activities").insert({
      lead_id: lead.id,
      account_id: accountId,
      activity_type: "status_changed",
      description: `[IA] ${reason}`,
      old_value: currentStatus.name,
      new_value: newStatus.name,
      created_by: null,
    });

    // Trigger Meta CAPI event if mapping exists
    try {
      const { data: mapping } = await supabase
        .from("meta_event_mappings")
        .select("event_name, lead_type")
        .eq("account_id", accountId)
        .eq("status_id", newStatusId)
        .eq("is_active", true)
        .maybeSingle();

      if (mapping) {
        await fetch(`${SUPABASE_URL}/functions/v1/send-meta-event`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "x-internal-call": "true",
          },
          body: JSON.stringify({
            lead_id: lead.id,
            event_name: mapping.event_name,
            custom_data: { lead_type: mapping.lead_type },
          }),
        });
      }
    } catch (metaErr) {
      console.error(`Meta CAPI error for lead ${lead.id}:`, metaErr);
      // Don't fail the whole process for Meta errors
    }

    return { advanced: true };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`AI timeout for lead ${lead.id}`);
      await supabase.from("ai_funnel_logs").insert({
        account_id: accountId,
        lead_id: lead.id,
        previous_status_id: lead.status_id,
        ai_summary: "Timeout na chamada de IA (15s)",
        action_taken: "error",
        messages_analyzed: messages.length,
      });
    }
    throw err;
  }
}
