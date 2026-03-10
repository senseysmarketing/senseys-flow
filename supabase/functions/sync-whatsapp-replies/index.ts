import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * sync-whatsapp-replies (Cron every 3 minutes)
 * 
 * Resolves @lid messages by temporal correlation:
 * When a lead receives a greeting and replies via @lid (private WhatsApp ID),
 * this function matches the reply to the correct lead based on timing.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('[sync-whatsapp-replies] Starting @lid correlation...')

    // Step 1: Find all incoming @lid messages with no lead_id (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: lidMessages, error: lidError } = await supabase
      .from('whatsapp_messages')
      .select('id, account_id, remote_jid, timestamp, content, phone, contact_name')
      .eq('is_from_me', false)
      .is('lead_id', null)
      .like('remote_jid', '%@lid')
      .gte('timestamp', twentyFourHoursAgo)
      .order('timestamp', { ascending: true })
      .limit(100)

    if (lidError) {
      console.error('[sync-whatsapp-replies] Error fetching @lid messages:', lidError)
      throw lidError
    }

    if (!lidMessages || lidMessages.length === 0) {
      console.log('[sync-whatsapp-replies] No unresolved @lid messages found')
      return new Response(
        JSON.stringify({ success: true, resolved: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[sync-whatsapp-replies] Found ${lidMessages.length} unresolved @lid messages`)

    let resolvedCount = 0
    let cancelledFollowups = 0

    // Group by account_id for efficiency
    const byAccount: Record<string, typeof lidMessages> = {}
    for (const msg of lidMessages) {
      if (!byAccount[msg.account_id]) byAccount[msg.account_id] = []
      byAccount[msg.account_id].push(msg)
    }

    for (const [accountId, accountLidMsgs] of Object.entries(byAccount)) {
      // Step 2: Get all outgoing greetings with lead_id for this account (last 24h)
      const { data: greetings, error: greetErr } = await supabase
        .from('whatsapp_messages')
        .select('id, lead_id, phone, remote_jid, timestamp, account_id')
        .eq('account_id', accountId)
        .eq('is_from_me', true)
        .not('lead_id', 'is', null)
        .gte('timestamp', twentyFourHoursAgo)
        .order('timestamp', { ascending: false })

      if (greetErr || !greetings || greetings.length === 0) {
        console.log(`[sync-whatsapp-replies] No outgoing greetings for account ${accountId}`)
        continue
      }

      // Also check already-mapped lid_jids to avoid re-resolving
      const { data: existingMappings } = await supabase
        .from('whatsapp_conversations')
        .select('lid_jid, lead_id')
        .eq('account_id', accountId)
        .not('lid_jid', 'is', null)

      const mappedLids = new Set((existingMappings || []).map(m => m.lid_jid))
      const mappedLeadIds = new Set((existingMappings || []).map(m => m.lead_id).filter(Boolean))

      for (const lidMsg of accountLidMsgs) {
        // Skip if this @lid is already mapped
        if (mappedLids.has(lidMsg.remote_jid)) continue

        const lidTimestamp = new Date(lidMsg.timestamp).getTime()
        const CORRELATION_WINDOW_MS = 60 * 60 * 1000 // 60 minutes

        // Step 3: Find the most recent greeting sent BEFORE the @lid reply
        // within the correlation window
        let bestMatch: typeof greetings[0] | null = null

        for (const greeting of greetings) {
          const greetingTimestamp = new Date(greeting.timestamp).getTime()

          // Greeting must be BEFORE the @lid reply
          if (greetingTimestamp >= lidTimestamp) continue

          // Within 60-minute window
          if (lidTimestamp - greetingTimestamp > CORRELATION_WINDOW_MS) continue

          // Skip if this lead_id already has a @lid mapped
          if (mappedLeadIds.has(greeting.lead_id)) continue

          // Best match = most recent greeting before the reply
          bestMatch = greeting
          break // Already sorted DESC, first match is best
        }

        if (!bestMatch) continue

        // Step 4: Atomic claim — try to set lid_jid on the conversation only if not already mapped.
        // This prevents race conditions when two workers run simultaneously: the first to claim wins.
        const leadPhone = bestMatch.phone?.replace(/\D/g, '') || ''
        const leadRemoteJid = `${leadPhone}@s.whatsapp.net`

        // Try to claim via phone-based conversation (most common case)
        const { data: claimedByPhone } = await supabase
          .from('whatsapp_conversations')
          .update({ lid_jid: lidMsg.remote_jid, lead_id: bestMatch.lead_id })
          .eq('account_id', accountId)
          .eq('remote_jid', leadRemoteJid)
          .is('lid_jid', null) // Only claim if not already mapped — prevents race condition
          .select('id')

        // If phone-based claim failed, try claiming via lead_id-based conversation
        if (!claimedByPhone || claimedByPhone.length === 0) {
          const { data: claimedByLead } = await supabase
            .from('whatsapp_conversations')
            .update({ lid_jid: lidMsg.remote_jid })
            .eq('account_id', accountId)
            .eq('lead_id', bestMatch.lead_id)
            .is('lid_jid', null) // Only claim if not already mapped
            .select('id')

          if (!claimedByLead || claimedByLead.length === 0) {
            // Another process already claimed this mapping — skip to avoid duplicate correlation
            console.log(`[sync-whatsapp-replies] ⚠️ SKIP: @lid ${lidMsg.remote_jid} -> lead ${bestMatch.lead_id} already claimed by another process`)
            mappedLids.add(lidMsg.remote_jid)
            mappedLeadIds.add(bestMatch.lead_id)
            continue
          }
        }

        console.log(`[sync-whatsapp-replies] ✅ MATCH: @lid ${lidMsg.remote_jid} -> lead ${bestMatch.lead_id} (greeting at ${bestMatch.timestamp}, reply at ${lidMsg.timestamp})`)

        // Step 5: Update the @lid message with the lead_id (now safe — claim was successful)
        await supabase
          .from('whatsapp_messages')
          .update({ lead_id: bestMatch.lead_id })
          .eq('id', lidMsg.id)

        // Also update any other messages from this same @lid
        await supabase
          .from('whatsapp_messages')
          .update({ lead_id: bestMatch.lead_id })
          .eq('account_id', accountId)
          .eq('remote_jid', lidMsg.remote_jid)
          .is('lead_id', null)

        // Step 6: Cancel ALL pending follow-ups for this lead
        const { data: cancelledMsgs } = await supabase
          .from('whatsapp_message_queue')
          .update({
            status: 'cancelled',
            error_message: `Cancelado: lead respondeu via @lid (correlação temporal por sync-whatsapp-replies)`
          })
          .eq('lead_id', bestMatch.lead_id)
          .eq('account_id', accountId)
          .eq('status', 'pending')
          .not('followup_step_id', 'is', null)
          .select('id')

        if (cancelledMsgs && cancelledMsgs.length > 0) {
          cancelledFollowups += cancelledMsgs.length
          console.log(`[sync-whatsapp-replies] 🚫 Cancelled ${cancelledMsgs.length} pending follow-ups for lead ${bestMatch.lead_id}`)
        }

        // Also cancel pending greeting sequence steps
        const { data: cancelledGreetings } = await supabase
          .from('whatsapp_message_queue')
          .update({
            status: 'cancelled',
            error_message: `Cancelado: lead respondeu via @lid (correlação temporal)`
          })
          .eq('lead_id', bestMatch.lead_id)
          .eq('account_id', accountId)
          .eq('status', 'pending')
          .select('id')

        if (cancelledGreetings && cancelledGreetings.length > 0) {
          cancelledFollowups += cancelledGreetings.length
        }

        resolvedCount++
        mappedLids.add(lidMsg.remote_jid)
        mappedLeadIds.add(bestMatch.lead_id)
      }
    }

    console.log(`[sync-whatsapp-replies] Completed: ${resolvedCount} @lid messages resolved, ${cancelledFollowups} follow-ups cancelled`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        resolved: resolvedCount,
        cancelledFollowups 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[sync-whatsapp-replies] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
