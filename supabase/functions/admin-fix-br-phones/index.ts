import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const results: string[] = []

  // 1. Mark automations as responded where customer already replied
  const idsToRespond = [
    'ae0b2c85-fedf-4d67-b93b-243b0e8409b2', // Marilene
    'e18952df-a0f4-4c33-928b-5d17fbc6cc1e', // Erenita
    'ea545b33-7a31-4e4d-b18c-f3faa8930dd8', // Lúcia
    'de3a2c46-f760-4788-b25f-936cd5350a43', // Lucas Andre
    '5782f4bf-feeb-42bf-aa39-9b615cd30e48', // Amaury
  ]

  const { data: updated, error: updateErr } = await supabase
    .from('whatsapp_automation_control')
    .update({ status: 'responded', conversation_state: 'customer_replied', updated_at: new Date().toISOString() })
    .in('id', idsToRespond)
    .eq('status', 'active')
    .select('id, lead_id')

  results.push(`Marked ${updated?.length || 0} automations as responded`)

  // 2. Cancel pending follow-up messages for these leads
  const leadIds = updated?.map((r: any) => r.lead_id) || []
  if (leadIds.length > 0) {
    const { data: cancelled } = await supabase
      .from('whatsapp_message_queue')
      .update({ status: 'cancelled', error_message: 'Cancelado: lead já respondeu (fix BR phone)' })
      .in('lead_id', leadIds)
      .eq('status', 'pending')
      .not('followup_step_id', 'is', null)
      .select('id')

    results.push(`Cancelled ${cancelled?.length || 0} pending follow-up messages`)
  }

  // 3. Merge duplicate conversations (same number with/without 9th digit)
  // Find conversations where phone is 8-digit BR and a 9-digit version exists
  const { data: allConvs } = await supabase
    .from('whatsapp_conversations')
    .select('id, account_id, phone, lead_id, last_customer_message_at, remote_jid')
    .order('created_at', { ascending: true })
    .limit(2000)

  let mergedCount = 0
  if (allConvs) {
    const convsByAccount: Record<string, any[]> = {}
    for (const conv of allConvs) {
      if (!convsByAccount[conv.account_id]) convsByAccount[conv.account_id] = []
      convsByAccount[conv.account_id].push(conv)
    }

    for (const [accountId, convs] of Object.entries(convsByAccount)) {
      // Group by normalized phone (strip to last 8 digits)
      const byNorm: Record<string, any[]> = {}
      for (const conv of convs) {
        const digits = conv.phone.replace(/\D/g, '')
        // Normalize: if BR 13-digit, take last 8
        let key = digits.slice(-8)
        if (!byNorm[key]) byNorm[key] = []
        byNorm[key].push(conv)
      }

      for (const [key, group] of Object.entries(byNorm)) {
        if (group.length <= 1) continue
        // Find the one with lead_id (primary)
        const withLead = group.find((c: any) => c.lead_id)
        const withReply = group.find((c: any) => c.last_customer_message_at && !c.lead_id)
        
        if (withLead && withReply) {
          // Transfer customer reply timestamp to the primary conversation
          await supabase
            .from('whatsapp_conversations')
            .update({ 
              last_customer_message_at: withReply.last_customer_message_at,
              updated_at: new Date().toISOString()
            })
            .eq('id', withLead.id)
          
          // Transfer lead_id to the orphan conversation too
          await supabase
            .from('whatsapp_conversations')
            .update({ lead_id: withLead.lead_id })
            .eq('id', withReply.id)
            .is('lead_id', null)
          
          mergedCount++
        }
      }
    }
  }
  results.push(`Merged ${mergedCount} duplicate conversation pairs`)

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
