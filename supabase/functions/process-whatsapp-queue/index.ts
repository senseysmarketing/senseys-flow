import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function formatPhoneForEvolution(phone: string): string {
  let cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('55') && cleaned.length >= 12) return cleaned
  if (cleaned.length >= 10 && cleaned.length <= 11) return '55' + cleaned
  return cleaned
}

// ─── Business Hours: next valid send time ───────────────────────────────────
interface SendingSchedule {
  is_enabled: boolean
  start_hour: number
  end_hour: number
  allowed_days: number[]
}

function getNextValidSendTime(proposedMs: number, schedule: SendingSchedule): number {
  if (!schedule.is_enabled) return proposedMs
  if (!schedule.allowed_days || schedule.allowed_days.length === 0) return proposedMs

  const TZ = 'America/Sao_Paulo'

  function getSPParts(ms: number) {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour12: false,
    })
    const parts = fmt.formatToParts(new Date(ms))
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''

    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    return {
      dayOfWeek: weekdayMap[get('weekday')] ?? 0,
      hour: parseInt(get('hour'), 10),
      minute: parseInt(get('minute'), 10),
      year: parseInt(get('year'), 10),
      month: parseInt(get('month'), 10),
      day: parseInt(get('day'), 10),
    }
  }

  function buildSPTimestamp(year: number, month: number, day: number, hour: number): number {
    const localStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00`
    const testDate = new Date(localStr + 'Z')
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hour: 'numeric',
      hour12: false,
      timeZoneName: 'shortOffset',
    })
    const parts = formatter.formatToParts(testDate)
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT-3'
    const offsetMatch = tzName.match(/GMT([+-])(\d+)(?::(\d+))?/)
    const sign = offsetMatch?.[1] === '+' ? 1 : -1
    const offsetHours = parseInt(offsetMatch?.[2] ?? '3', 10)
    const offsetMins = parseInt(offsetMatch?.[3] ?? '0', 10)
    const offsetMs = sign * (offsetHours * 60 + offsetMins) * 60 * 1000

    const spLocalMs = new Date(`${localStr}`).getTime()
    return spLocalMs - offsetMs
  }

  let candidateMs = proposedMs
  const MAX_DAYS = 7

  for (let attempt = 0; attempt < MAX_DAYS * 24 * 60; attempt++) {
    const p = getSPParts(candidateMs)
    const { dayOfWeek, hour, year, month, day } = p

    const dayAllowed = schedule.allowed_days.includes(dayOfWeek)

    if (dayAllowed && hour >= schedule.start_hour && hour < schedule.end_hour) {
      return candidateMs
    }

    if (!dayAllowed || hour >= schedule.end_hour) {
      let nextDay = dayOfWeek
      let daysAdded = 1
      for (let d = 1; d <= 7; d++) {
        nextDay = (dayOfWeek + d) % 7
        if (schedule.allowed_days.includes(nextDay)) {
          daysAdded = d
          break
        }
      }
      const nextDate = new Date(candidateMs)
      nextDate.setUTCDate(nextDate.getUTCDate() + daysAdded)
      const np = getSPParts(nextDate.getTime())
      candidateMs = buildSPTimestamp(np.year, np.month, np.day, schedule.start_hour)
      return candidateMs
    }

    if (hour < schedule.start_hour) {
      candidateMs = buildSPTimestamp(year, month, day, schedule.start_hour)
      return candidateMs
    }
  }

  return proposedMs
}

// ─── Safe replacement helper ────────────────────────────────────────────────
// Escapes $ in replacement strings to prevent String.replace() backreference injection.
// In JS replace(), $1/$2/etc and $& have special meaning — must be escaped as $$.
function safeReplaceValue(value: string | null | undefined): string {
  return (value || '').replace(/\$/g, '$$$$')
}

// ─── Variable substitution helper ──────────────────────────────────────────
async function substituteTemplateVariables(
  supabase: any,
  template: string,
  leadId: string,
  accountId: string,
): Promise<string> {
  let message = template

  // Get lead data
  const { data: lead } = await supabase
    .from('leads')
    .select('name, phone, email, property_id, assigned_broker_id, properties!leads_property_id_fkey(title), profiles!leads_assigned_broker_id_fkey(full_name)')
    .eq('id', leadId)
    .single()

  if (lead) {
    message = message
      .replace(/{nome}/gi, safeReplaceValue(lead.name))
      .replace(/{telefone}/gi, safeReplaceValue(lead.phone))
      .replace(/{email}/gi, safeReplaceValue(lead.email))

    // Robust property title resolution with fallback
    let propertyTitle = (lead.properties as any)?.title || ''
    if (!propertyTitle && lead.property_id) {
      const { data: prop } = await supabase
        .from('properties')
        .select('title')
        .eq('id', lead.property_id)
        .single()
      propertyTitle = prop?.title || ''
    }
    message = message.replace(/{imovel}/gi, safeReplaceValue(propertyTitle.trim()))

    if (lead.profiles) {
      message = message.replace(/{corretor}/gi, safeReplaceValue((lead.profiles as any).full_name))
    } else {
      message = message.replace(/{corretor}/gi, '')
    }
  }

  // Get company info
  const { data: account } = await supabase
    .from('accounts')
    .select('name, company_name')
    .eq('id', accountId)
    .single()

  if (account) {
    message = message.replace(/{empresa}/gi, safeReplaceValue(account.company_name || account.name))
  } else {
    message = message.replace(/{empresa}/gi, '')
  }

  // Replace {form_*} variables
  if (message.includes('{form_')) {
    const formVarMatches = message.match(/\{form_[^}]+\}/gi)
    if (formVarMatches) {
      const { data: formFields } = await supabase
        .from('lead_form_field_values')
        .select('field_name, field_value')
        .eq('lead_id', leadId)

      if (formFields && formFields.length > 0) {
        for (const match of formVarMatches) {
          const fieldName = match.slice(6, -1)
          const found = formFields.find((f: any) => {
            const normalize = (s: string) => s.toLowerCase().replace(/\?/g, '').replace(/_/g, ' ').trim()
            return normalize(f.field_name) === normalize(fieldName)
          })
          // Use safeReplaceValue to prevent $1/$& backreference injection from DB values
          message = message.replace(new RegExp(match.replace(/[{}?]/g, (c: string) => `\\${c}`), 'gi'), safeReplaceValue(found?.field_value))
        }
      } else {
        // Try custom fields
        const { data: customFields } = await supabase
          .from('lead_custom_field_values')
          .select('value, custom_fields(field_key)')
          .eq('lead_id', leadId)

        if (customFields && customFields.length > 0) {
          const normalizeStr = (s: string) => s.toLowerCase().replace(/\?/g, '').replace(/_/g, ' ').trim()
          for (const match of formVarMatches) {
            const fieldName = match.slice(6, -1)
            const found = customFields.find((f: any) =>
              normalizeStr((f.custom_fields as any)?.field_key || '') === normalizeStr(fieldName)
            )
            message = message.replace(new RegExp(match.replace(/[{}?]/g, (c: string) => `\\${c}`), 'gi'), safeReplaceValue(found?.value))
          }
        } else {
          for (const match of formVarMatches) {
            message = message.replace(new RegExp(match.replace(/[{}?]/g, (c: string) => `\\${c}`), 'gi'), '')
          }
        }
      }
    }
  }

  return message
}
// ────────────────────────────────────────────────────────────────────────────

// ─── Session verification with auto-repair ─────────────────────────────────
async function verifySession(supabase: any, accountId: string): Promise<{ connected: boolean; instanceName: string | null }> {
  const { data: session } = await supabase
    .from('whatsapp_sessions')
    .select('status, instance_name')
    .eq('account_id', accountId)
    .maybeSingle()

  if (!session) return { connected: false, instanceName: null }

  if (session.status === 'connected') {
    return { connected: true, instanceName: session.instance_name }
  }

  // Auto-repair: check Evolution API
  const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || ''
  const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || ''
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) return { connected: false, instanceName: session.instance_name }

  const apiUrl = EVOLUTION_API_URL.startsWith('http') ? EVOLUTION_API_URL : `https://${EVOLUTION_API_URL}`
  try {
    const statusResp = await fetch(
      `${apiUrl}/instance/connectionState/${session.instance_name}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    )
    if (statusResp.ok) {
      const statusData = await statusResp.json()
      if (statusData.instance?.state === 'open') {
        await supabase.from('whatsapp_sessions')
          .update({ status: 'connected', updated_at: new Date().toISOString() })
          .eq('account_id', accountId)
        console.log(`[process-whatsapp-queue] ✅ Session auto-repaired for account ${accountId}`)
        return { connected: true, instanceName: session.instance_name }
      }
    }
  } catch (e) {
    console.error(`[process-whatsapp-queue] Error checking Evolution API:`, e)
  }

  return { connected: false, instanceName: session.instance_name }
}
// ────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════
// ═══ NEW: Automation Control State Machine Processing ═══════════════════
// ═══════════════════════════════════════════════════════════════════════════

async function processAutomationControl(supabase: any, supabaseUrl: string, supabaseServiceKey: string): Promise<{ processed: number; errors: number }> {
  let processed = 0
  let errors = 0

  // 1. Recover stuck records (processing for more than 5 minutes)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { data: stuckRecords } = await supabase
    .from('whatsapp_automation_control')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('status', 'processing')
    .lt('updated_at', fiveMinAgo)
    .select('id')

  if (stuckRecords?.length > 0) {
    console.log(`[automation-control] Recovered ${stuckRecords.length} stuck records`)
  }

  // 2. Select active records ready for execution
  const { data: readyRecords, error: fetchErr } = await supabase
    .from('whatsapp_automation_control')
    .select('*')
    .eq('status', 'active')
    .lte('next_execution_at', new Date().toISOString())
    .order('next_execution_at', { ascending: true })
    .limit(30)

  if (fetchErr) {
    console.error('[automation-control] Error fetching records:', fetchErr)
    return { processed: 0, errors: 0 }
  }

  if (!readyRecords || readyRecords.length === 0) {
    console.log('[automation-control] No records to process')
    return { processed: 0, errors: 0 }
  }

  console.log(`[automation-control] Found ${readyRecords.length} records to process`)

  // Cache schedules per account
  const scheduleCache: Record<string, SendingSchedule | null> = {}
  async function getSchedule(accountId: string): Promise<SendingSchedule | null> {
    if (accountId in scheduleCache) return scheduleCache[accountId]
    const { data } = await (supabase.from('whatsapp_sending_schedule' as any) as any)
      .select('is_enabled, start_hour, end_hour, allowed_days')
      .eq('account_id', accountId)
      .maybeSingle()
    scheduleCache[accountId] = data ?? null
    return scheduleCache[accountId]
  }

  for (const record of readyRecords) {
    try {
      // a. Optimistic lock: UPDATE SET status='processing' WHERE status='active' RETURNING *
      const { data: locked, error: lockErr } = await supabase
        .from('whatsapp_automation_control')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', record.id)
        .eq('status', 'active')
        .select()
        .maybeSingle()

      if (lockErr || !locked) {
        console.log(`[automation-control] Could not lock record ${record.id} (already processing)`)
        continue
      }

      // b. Temporal response check: only messages AFTER started_at
      const { data: hasResponse } = await supabase
        .from('whatsapp_messages')
        .select('id')
        .eq('lead_id', record.lead_id)
        .eq('is_from_me', false)
        .gt('created_at', record.started_at)
        .limit(1)

      if (hasResponse && hasResponse.length > 0) {
        await supabase
          .from('whatsapp_automation_control')
          .update({ status: 'responded', conversation_state: 'customer_replied', updated_at: new Date().toISOString() })
          .eq('id', record.id)
        console.log(`[automation-control] Lead ${record.lead_id} responded (temporal check), marking as responded`)
        continue
      }

      // b2. Cross-check: verify last_customer_message_at from conversation
      const { data: convCheck } = await supabase
        .from('whatsapp_conversations')
        .select('last_customer_message_at')
        .eq('lead_id', record.lead_id)
        .eq('account_id', record.account_id)
        .maybeSingle()

      if (convCheck?.last_customer_message_at) {
        const customerMsgAt = new Date(convCheck.last_customer_message_at).getTime()
        const automationStartedAt = new Date(record.started_at).getTime()
        if (customerMsgAt > automationStartedAt) {
          await supabase
            .from('whatsapp_automation_control')
            .update({ status: 'responded', conversation_state: 'customer_replied', updated_at: new Date().toISOString() })
            .eq('id', record.id)
          console.log(`[automation-control] Lead ${record.lead_id} responded (cross-check last_customer_message_at), marking as responded`)
          continue
        }
      }

      // b3. Minimum window: prevent two messages within 2 minutes (anti-loop)
      const lastSendTimestamp = record.last_followup_sent_at || record.updated_at
      const timeSinceLastSend = Date.now() - new Date(lastSendTimestamp).getTime()
      if (timeSinceLastSend < 120_000) { // 2 minutes
        const retryAt = new Date(new Date(lastSendTimestamp).getTime() + 120_000).toISOString()
        await supabase
          .from('whatsapp_automation_control')
          .update({ status: 'active', next_execution_at: retryAt, updated_at: new Date().toISOString() })
          .eq('id', record.id)
        console.log(`[automation-control] ⛔ Minimum window: lead ${record.lead_id} last send ${Math.round(timeSinceLastSend/1000)}s ago, rescheduled to ${retryAt}`)
        continue
      }

      // c. Business hours check
      const schedule = await getSchedule(record.account_id)
      if (schedule?.is_enabled) {
        const nowMs = Date.now()
        const nextValidMs = getNextValidSendTime(nowMs, schedule)
        if (nextValidMs > nowMs) {
          await supabase
            .from('whatsapp_automation_control')
            .update({
              status: 'active',
              next_execution_at: new Date(nextValidMs).toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', record.id)
          console.log(`[automation-control] Record ${record.id} rescheduled to business hours: ${new Date(nextValidMs).toISOString()}`)
          continue
        }
      }

      // d. Verify WhatsApp session
      const sessionInfo = await verifySession(supabase, record.account_id)
      if (!sessionInfo.connected) {
        await supabase
          .from('whatsapp_automation_control')
          .update({
            status: 'active',
            next_execution_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', record.id)
        console.log(`[automation-control] Session not connected for account ${record.account_id}, retrying in 2min`)
        continue
      }

      // e. Read current step from snapshot
      const snapshot = record.steps_snapshot || {}
      const phase = record.current_phase
      const stepPos = record.current_step_position

      let currentStep: any = null
      let stepsInPhase: any[] = []

      if (phase === 'greeting') {
        stepsInPhase = snapshot.greeting || []
        currentStep = stepsInPhase[stepPos]
      } else if (phase === 'waiting_response') {
        // Check if lead responded; if not, transition to followup
        const { data: responded } = await supabase
          .from('whatsapp_messages')
          .select('id')
          .eq('lead_id', record.lead_id)
          .eq('is_from_me', false)
          .gt('created_at', record.started_at)
          .limit(1)

        if (responded && responded.length > 0) {
          await supabase
            .from('whatsapp_automation_control')
            .update({ status: 'responded', conversation_state: 'customer_replied', updated_at: new Date().toISOString() })
            .eq('id', record.id)
          console.log(`[automation-control] Lead ${record.lead_id} responded during waiting_response phase`)
          continue
        }

        // Transition to followup
        const followupSteps = snapshot.followup || []
        if (followupSteps.length === 0) {
          await supabase
            .from('whatsapp_automation_control')
            .update({ status: 'finished', conversation_state: 'closed_no_reply', updated_at: new Date().toISOString() })
            .eq('id', record.id)
          console.log(`[automation-control] Lead ${record.lead_id} finished (no followup steps)`)
          continue
        }

        // Move to followup phase, step 0
        stepsInPhase = followupSteps
        currentStep = stepsInPhase[0]
        // Will update phase below after sending
        await supabase
          .from('whatsapp_automation_control')
          .update({
            current_phase: 'followup',
            current_step_position: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', record.id)
        // Reload record phase for update below
        record.current_phase = 'followup'
        record.current_step_position = 0
      } else if (phase === 'followup') {
        stepsInPhase = snapshot.followup || []
        currentStep = stepsInPhase[stepPos]

        // Safety net: double-check that enough time has elapsed since last followup
        if (currentStep && (record as any).last_followup_sent_at) {
          const lastSentAt = new Date((record as any).last_followup_sent_at).getTime()
          const requiredDelayMs = Math.max(currentStep.delay_minutes || 1440, 60) * 60 * 1000
          const elapsed = Date.now() - lastSentAt
          if (elapsed < requiredDelayMs * 0.9) { // 90% threshold to account for minor timing differences
            console.log(`[automation-control] ⛔ Safety net: follow-up[${stepPos}] for lead ${record.lead_id} blocked. Elapsed=${Math.round(elapsed/60000)}min, required=${Math.round(requiredDelayMs/60000)}min`)
            // Reschedule to correct time
            const correctNextExec = new Date(lastSentAt + requiredDelayMs).toISOString()
            await supabase
              .from('whatsapp_automation_control')
              .update({ status: 'active', next_execution_at: correctNextExec, updated_at: new Date().toISOString() })
              .eq('id', record.id)
            continue
          }
        }
      }

      if (!currentStep) {
        // No more steps — determine if finished or need to transition
        if (phase === 'greeting') {
          // Move to waiting_response
          const followupSteps = snapshot.followup || []
          const firstFollowupDelay = followupSteps.length > 0 ? (followupSteps[0].delay_minutes || 1440) : 1440
          const nextExecMs = Date.now() + firstFollowupDelay * 60 * 1000
          const adjustedMs = schedule?.is_enabled ? getNextValidSendTime(nextExecMs, schedule) : nextExecMs

          await supabase
            .from('whatsapp_automation_control')
            .update({
              current_phase: followupSteps.length > 0 ? 'waiting_response' : 'finished',
              current_step_position: 0,
              status: followupSteps.length > 0 ? 'active' : 'finished',
              conversation_state: followupSteps.length > 0 ? 'waiting_reply' : 'closed_no_reply',
              next_execution_at: new Date(adjustedMs).toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', record.id)
          console.log(`[automation-control] Lead ${record.lead_id} greeting complete, ${followupSteps.length > 0 ? 'waiting for response' : 'finished'}`)
          continue
        } else {
          // Followup exhausted
          await supabase
            .from('whatsapp_automation_control')
            .update({ status: 'finished', conversation_state: 'closed_no_reply', updated_at: new Date().toISOString() })
            .eq('id', record.id)
          console.log(`[automation-control] Lead ${record.lead_id} all followups sent, finished`)
          continue
        }
      }

      // f. Substitute template variables
      let message = currentStep.template_content || ''
      if (message) {
        message = await substituteTemplateVariables(supabase, message, record.lead_id, record.account_id)
      }

      // g. Send via whatsapp-send
      const formattedPhone = formatPhoneForEvolution(record.phone)
      console.log(`[automation-control] Sending ${phase}[${stepPos}] to lead ${record.lead_id} (${formattedPhone})`)

      const sendResponse = await fetch(
        `${supabaseUrl}/functions/v1/whatsapp-send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'x-internal-call': 'true'
          },
          body: JSON.stringify({
            account_id: record.account_id,
            phone: formattedPhone,
            message: message,
            lead_id: record.lead_id,
            template_id: currentStep.template_id
          })
        }
      )

      const sendResult = await sendResponse.json()

      // Handle invalid number
      if (sendResult.invalid_number) {
        console.log(`[automation-control] Invalid number for lead ${record.lead_id}: ${sendResult.error}`)
        await supabase
          .from('whatsapp_automation_control')
          .update({ status: 'failed', conversation_state: 'automation_finished', updated_at: new Date().toISOString() })
          .eq('id', record.id)
        errors++
        continue
      }

      if (!sendResponse.ok) {
        const newRetryCount = (record.retry_count || 0) + 1
        console.log(`[automation-control] ❌ Send failed for lead ${record.lead_id} (attempt ${newRetryCount}/5): ${sendResult.error}`)
        
        if (newRetryCount >= 5) {
          // Max retries reached — mark as failed permanently
          await supabase
            .from('whatsapp_automation_control')
            .update({ 
              status: 'failed', 
              conversation_state: 'automation_finished', 
              retry_count: newRetryCount,
              updated_at: new Date().toISOString() 
            })
            .eq('id', record.id)
          console.log(`[automation-control] 🛑 Lead ${record.lead_id} marked as FAILED after ${newRetryCount} attempts`)
        } else {
          // Reschedule with exponential backoff: 2min, 4min, 8min, 16min
          const backoffMs = Math.pow(2, newRetryCount) * 60 * 1000
          await supabase
            .from('whatsapp_automation_control')
            .update({ 
              status: 'active', 
              retry_count: newRetryCount,
              next_execution_at: new Date(Date.now() + backoffMs).toISOString(),
              updated_at: new Date().toISOString() 
            })
            .eq('id', record.id)
        }
        errors++
        continue
      }

      // h. Extract remote_jid from send response and lock JID on first send
      const updateData: any = {
        current_step_position: record.current_step_position + 1,
        total_messages_sent: (record.total_messages_sent || 0) + 1,
        last_sent_message_id: sendResult.messageId || sendResult.key?.id || null,
        updated_at: new Date().toISOString(),
      }

      // Lock JID on first successful send
      if (!record.jid_locked && sendResult.key?.remoteJid) {
        updateData.remote_jid = sendResult.key.remoteJid
        updateData.jid_locked = true
        console.log(`[automation-control] JID locked for lead ${record.lead_id}: ${sendResult.key.remoteJid}`)
      }

      // i. Determine next step and timing
      const nextStepPos = record.current_step_position + 1
      const currentPhase = record.current_phase

      if (currentPhase === 'greeting') {
        const greetingSteps = snapshot.greeting || []
        if (nextStepPos < greetingSteps.length) {
          // More greeting steps
          const nextStep = greetingSteps[nextStepPos]
          const delayMs = (nextStep.delay_seconds || 5) * 1000
          const nextExecMs = Date.now() + delayMs
          const adjustedMs = schedule?.is_enabled ? getNextValidSendTime(nextExecMs, schedule) : nextExecMs

          updateData.status = 'active'
          updateData.next_execution_at = new Date(adjustedMs).toISOString()
          updateData.conversation_state = 'greeting_sent'
        } else {
          // Greeting complete — move to waiting_response or finish
          const followupSteps = snapshot.followup || []
          if (followupSteps.length > 0) {
            const firstFollowupDelay = followupSteps[0].delay_minutes || 1440
            const nextExecMs = Date.now() + firstFollowupDelay * 60 * 1000
            const adjustedMs = schedule?.is_enabled ? getNextValidSendTime(nextExecMs, schedule) : nextExecMs

            updateData.current_phase = 'waiting_response'
            updateData.current_step_position = 0
            updateData.status = 'active'
            updateData.next_execution_at = new Date(adjustedMs).toISOString()
            updateData.conversation_state = 'waiting_reply'
          } else {
            updateData.status = 'finished'
            updateData.conversation_state = 'closed_no_reply'
          }
        }
    } else if (currentPhase === 'followup') {
        const followupSteps = snapshot.followup || []
        if (nextStepPos < followupSteps.length) {
          // More followup steps — use the NEXT step's delay directly (each step delay is individual, not cumulative)
          const nextStep = followupSteps[nextStepPos]
          const deltaMinutes = Math.max(nextStep.delay_minutes || 1440, 60)
          const nextExecMs = Date.now() + deltaMinutes * 60 * 1000
          const adjustedMs = schedule?.is_enabled ? getNextValidSendTime(nextExecMs, schedule) : nextExecMs

          updateData.status = 'active'
          updateData.next_execution_at = new Date(adjustedMs).toISOString()
          updateData.conversation_state = `followup_${nextStepPos}_sent`
          console.log(`[automation-control] 📊 Follow-up delay: nextStep[${nextStepPos}].delay_minutes=${nextStep.delay_minutes}, deltaMinutes=${deltaMinutes}, next_execution_at=${updateData.next_execution_at}`)
        } else {
          // All followups sent
          updateData.status = 'finished'
          updateData.conversation_state = 'closed_no_reply'
        }
      }

      // Safety net: record when the last followup was sent
      if (currentPhase === 'followup' || currentPhase === 'waiting_response') {
        updateData.last_followup_sent_at = new Date().toISOString()
      }

      await supabase
        .from('whatsapp_automation_control')
        .update(updateData)
        .eq('id', record.id)

      processed++
      console.log(`[automation-control] ✅ ${currentPhase}[${stepPos}] sent for lead ${record.lead_id} (record=${record.id}), phase=${currentPhase}, step=${stepPos}, next: ${updateData.status === 'active' ? updateData.next_execution_at : updateData.status}`)

      // Rate limiting: 1.5s between sends
      await sleep(1500)

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[automation-control] Error processing record ${record.id}:`, err)

      // Return to active for retry (unless too many failures)
      await supabase
        .from('whatsapp_automation_control')
        .update({
          status: 'active',
          next_execution_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', record.id)

      errors++
    }
  }

  return { processed, errors }
}

// ═══════════════════════════════════════════════════════════════════════════
// ═══ LEGACY: Queue-based Processing (whatsapp_message_queue) ════════════
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('[process-whatsapp-queue] Starting queue processing...')

    // ═══ BLOCK 1: Process NEW automation control (state machine) ═══
    const automationResult = await processAutomationControl(supabase, supabaseUrl, supabaseServiceKey)

    // ═══ BLOCK 2: Process LEGACY message queue ═══

    // Recover stuck legacy messages (processing for more than 5 minutes)
    const legacyStuckCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: stuckLegacy } = await supabase
      .from('whatsapp_message_queue')
      .update({ status: 'pending' })
      .eq('status', 'processing')
      .lt('scheduled_for', legacyStuckCutoff)
      .select('id')

    if (stuckLegacy?.length > 0) {
      console.log(`[process-whatsapp-queue] Recovered ${stuckLegacy.length} stuck legacy messages`)
    }

    const { data: pendingMessages, error: fetchError } = await supabase
      .from('whatsapp_message_queue')
      .select(`
        *,
        leads!inner(name, phone, email),
        whatsapp_templates(template)
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(50)

    if (fetchError) {
      console.error('[process-whatsapp-queue] Error fetching messages:', fetchError)
      throw fetchError
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('[process-whatsapp-queue] No pending legacy messages to process')
      return new Response(
        JSON.stringify({
          success: true,
          processed: automationResult.processed,
          errors: automationResult.errors,
          legacy_processed: 0,
          message: 'Queue processing complete'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[process-whatsapp-queue] Found ${pendingMessages.length} legacy messages to process`)

    // Cache sending schedules per account
    const scheduleCache: Record<string, SendingSchedule | null> = {}

    async function getScheduleForAccount(accountId: string): Promise<SendingSchedule | null> {
      if (accountId in scheduleCache) return scheduleCache[accountId]
      const { data } = await (supabase.from('whatsapp_sending_schedule' as any) as any)
        .select('is_enabled, start_hour, end_hour, allowed_days')
        .eq('account_id', accountId)
        .maybeSingle()
      scheduleCache[accountId] = data ?? null
      return scheduleCache[accountId]
    }

    let processedCount = 0
    let errorCount = 0
    const respondedLeads = new Set<string>()

    for (const msg of pendingMessages) {
      try {
        // ── Layer 0: Skip if lead already responded in this batch ─────────
        if (msg.lead_id && respondedLeads.has(msg.lead_id)) {
          console.log(`[process-whatsapp-queue] Lead ${msg.lead_id} already responded (cached in batch), cancelling ${msg.id}`)
          await supabase
            .from('whatsapp_message_queue')
            .update({ status: 'cancelled', error_message: 'Cancelado: lead respondeu (detectado no mesmo lote)' })
            .eq('id', msg.id)
          continue
        }

        // ── Layer 1: Optimistic lock (atomic UPDATE WHERE status='pending') ──
        const { data: locked, error: lockErr } = await supabase
          .from('whatsapp_message_queue')
          .update({ status: 'processing' })
          .eq('id', msg.id)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle()

        if (lockErr || !locked) {
          console.log(`[process-whatsapp-queue] Message ${msg.id} already picked up, skipping`)
          continue
        }

        // ── Business Hours Check ─────────────────────────────────────────────
        const schedule = await getScheduleForAccount(msg.account_id)
        if (schedule?.is_enabled) {
          const nowMs = Date.now()
          const nextValidMs = getNextValidSendTime(nowMs, schedule)
          if (nextValidMs > nowMs) {
            console.log(`[process-whatsapp-queue] Message ${msg.id} rescheduled to business hours: ${new Date(nextValidMs).toISOString()}`)
            await supabase
              .from('whatsapp_message_queue')
              .update({ scheduled_for: new Date(nextValidMs).toISOString() })
              .eq('id', msg.id)
            continue
          }
        }

        // Check WhatsApp session
        const sessionInfo = await verifySession(supabase, msg.account_id)
        if (!sessionInfo.connected) {
          console.log(`[process-whatsapp-queue] Session not connected for account ${msg.account_id}, failing message ${msg.id}`)
          await supabase
            .from('whatsapp_message_queue')
            .update({ status: 'failed', error_message: 'WhatsApp não conectado' })
            .eq('id', msg.id)
          errorCount++
          continue
        }

        // Simple response check for legacy: by lead_id
        if (msg.lead_id) {
          const { data: incomingByLeadId } = await supabase
            .from('whatsapp_messages')
            .select('id')
            .eq('account_id', msg.account_id)
            .eq('lead_id', msg.lead_id)
            .eq('is_from_me', false)
            .limit(1)

          if (incomingByLeadId && incomingByLeadId.length > 0) {
            respondedLeads.add(msg.lead_id)
            console.log(`[process-whatsapp-queue] Lead ${msg.lead_id} responded, cancelling message ${msg.id}`)
            await supabase
              .from('whatsapp_message_queue')
              .update({
                status: 'cancelled',
                error_message: 'Cancelado: lead respondeu'
              })
              .eq('lead_id', msg.lead_id)
              .eq('status', 'pending')
            continue
          }
        }

        // Compose message with template variables
        let message = msg.message || ''
        if (msg.whatsapp_templates?.template) {
          message = msg.whatsapp_templates.template
        }

        // Use shared variable substitution
        if (msg.lead_id) {
          message = await substituteTemplateVariables(supabase, message, msg.lead_id, msg.account_id)
        }

        // Format phone number
        const phone = msg.phone || msg.leads?.phone || ''
        const formattedPhone = formatPhoneForEvolution(phone)

        console.log(`[process-whatsapp-queue] Processing legacy message ${msg.id} to ${formattedPhone}`)

        // Send via whatsapp-send
        const sendResponse = await fetch(
          `${supabaseUrl}/functions/v1/whatsapp-send`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'x-internal-call': 'true'
            },
            body: JSON.stringify({
              account_id: msg.account_id,
              phone: formattedPhone,
              message: message,
              lead_id: msg.lead_id,
              template_id: msg.template_id
            })
          }
        )

        const sendResult = await sendResponse.json()

        if (sendResult.invalid_number) {
          console.log(`[process-whatsapp-queue] Invalid number for message ${msg.id}`)
          await supabase
            .from('whatsapp_message_queue')
            .update({
              status: 'failed',
              error_message: 'Este número não existe no WhatsApp',
              retry_count: 99
            })
            .eq('id', msg.id)

          if (msg.lead_id) {
            await supabase
              .from('whatsapp_message_queue')
              .update({
                status: 'cancelled',
                error_message: 'Cancelado: número sem WhatsApp'
              })
              .eq('lead_id', msg.lead_id)
              .eq('status', 'pending')
          }
          errorCount++
          continue
        }

        if (!sendResponse.ok) {
          throw new Error(sendResult.error || 'Failed to send message')
        }

        await supabase
          .from('whatsapp_message_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', msg.id)
          .eq('status', 'processing')

        processedCount++
        console.log(`[process-whatsapp-queue] Legacy message ${msg.id} sent successfully`)

        // Rate limiting
        await sleep(1500)

      } catch (msgError: unknown) {
        const errorMessage = msgError instanceof Error ? msgError.message : 'Unknown error'
        console.error(`[process-whatsapp-queue] Error processing message ${msg.id}:`, msgError)

        const newRetryCount = (msg.retry_count || 0) + 1

        if (newRetryCount >= 3) {
          await supabase
            .from('whatsapp_message_queue')
            .update({
              status: 'failed',
              error_message: errorMessage,
              retry_count: newRetryCount
            })
            .eq('id', msg.id)
            .eq('status', 'processing')
        } else {
          await supabase
            .from('whatsapp_message_queue')
            .update({
              status: 'pending',
              retry_count: newRetryCount,
              error_message: errorMessage,
              scheduled_for: new Date(Date.now() + 5 * 60 * 1000).toISOString()
            })
            .eq('id', msg.id)
            .eq('status', 'processing')
        }

        errorCount++
      }
    }

    const totalProcessed = processedCount + automationResult.processed
    const totalErrors = errorCount + automationResult.errors

    console.log(`[process-whatsapp-queue] Completed: legacy=${processedCount} sent, automation=${automationResult.processed} sent, errors=${totalErrors}`)

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        errors: totalErrors,
        legacy_processed: processedCount,
        automation_processed: automationResult.processed,
        total: pendingMessages.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[process-whatsapp-queue] Error:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
