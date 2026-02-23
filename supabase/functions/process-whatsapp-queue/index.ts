import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Robust phone formatting for Evolution API
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

/**
 * Given a proposed timestamp and a business-hours config, returns the next
 * valid UTC timestamp that falls within the allowed window.
 * All comparisons are done in America/Sao_Paulo timezone.
 *
 * - end_hour is EXCLUSIVE (18 means messages can be sent up to 17:59)
 * - Iterates at most 7 days to avoid infinite loops
 * - If no allowed_days are set, returns the original timestamp unchanged
 */
function getNextValidSendTime(proposedMs: number, schedule: SendingSchedule): number {
  if (!schedule.is_enabled) return proposedMs
  if (!schedule.allowed_days || schedule.allowed_days.length === 0) return proposedMs

  const TZ = 'America/Sao_Paulo'

  // Helper: get numeric date parts in São Paulo timezone
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

  // Helper: build a UTC timestamp for a given São Paulo calendar date + hour:00
  function buildSPTimestamp(year: number, month: number, day: number, hour: number): number {
    // Create date string in SP local time and convert to UTC
    const localStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00`
    // Use Intl to get the UTC offset for this specific date in SP (handles DST)
    const testDate = new Date(localStr + 'Z') // temp UTC anchor
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hour: 'numeric',
      hour12: false,
      timeZoneName: 'shortOffset',
    })
    const parts = formatter.formatToParts(testDate)
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT-3'
    // Extract offset hours from "GMT-3" or "GMT-3:30"
    const offsetMatch = tzName.match(/GMT([+-])(\d+)(?::(\d+))?/)
    const sign = offsetMatch?.[1] === '+' ? 1 : -1
    const offsetHours = parseInt(offsetMatch?.[2] ?? '3', 10)
    const offsetMins = parseInt(offsetMatch?.[3] ?? '0', 10)
    const offsetMs = sign * (offsetHours * 60 + offsetMins) * 60 * 1000

    // Build UTC from local SP time
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
      // Valid window — return as-is
      return candidateMs
    }

    if (!dayAllowed || hour >= schedule.end_hour) {
      // Advance to next allowed day at start_hour
      let nextDay = dayOfWeek
      let daysAdded = 1
      for (let d = 1; d <= 7; d++) {
        nextDay = (dayOfWeek + d) % 7
        if (schedule.allowed_days.includes(nextDay)) {
          daysAdded = d
          break
        }
      }
      // Build timestamp for (current date + daysAdded) at start_hour:00
      const nextDate = new Date(candidateMs)
      nextDate.setUTCDate(nextDate.getUTCDate() + daysAdded)
      const np = getSPParts(nextDate.getTime())
      candidateMs = buildSPTimestamp(np.year, np.month, np.day, schedule.start_hour)
      return candidateMs
    }

    if (hour < schedule.start_hour) {
      // Same day, advance to start_hour
      candidateMs = buildSPTimestamp(year, month, day, schedule.start_hour)
      return candidateMs
    }
  }

  // Fallback: return original
  return proposedMs
}
// ────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('[process-whatsapp-queue] Starting queue processing...')

    // Get pending messages that are scheduled for now or earlier
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
      console.log('[process-whatsapp-queue] No pending messages to process')
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No pending messages' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[process-whatsapp-queue] Found ${pendingMessages.length} messages to process`)

    // Cache sending schedules per account to avoid repeated DB queries
    const scheduleCache: Record<string, SendingSchedule | null> = {}

    async function getScheduleForAccount(accountId: string): Promise<SendingSchedule | null> {
      if (accountId in scheduleCache) return scheduleCache[accountId]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from('whatsapp_sending_schedule' as any) as any)
        .select('is_enabled, start_hour, end_hour, allowed_days')
        .eq('account_id', accountId)
        .maybeSingle()
      scheduleCache[accountId] = data ?? null
      return scheduleCache[accountId]
    }

    let processedCount = 0
    let errorCount = 0

    for (const msg of pendingMessages) {
      try {
        // ── Business Hours Check ─────────────────────────────────────────────
        const schedule = await getScheduleForAccount(msg.account_id)
        if (schedule?.is_enabled) {
          const nowMs = Date.now()
          const nextValidMs = getNextValidSendTime(nowMs, schedule)
          if (nextValidMs > nowMs) {
            // Outside allowed window — reschedule and skip
            console.log(`[process-whatsapp-queue] Message ${msg.id} rescheduled to business hours: ${new Date(nextValidMs).toISOString()}`)
            await supabase
              .from('whatsapp_message_queue')
              .update({ scheduled_for: new Date(nextValidMs).toISOString() })
              .eq('id', msg.id)
            continue
          }
        }
        // ────────────────────────────────────────────────────────────────────

        // Check if WhatsApp session is still connected for this account
        const { data: session } = await supabase
          .from('whatsapp_sessions')
          .select('status, instance_name')
          .eq('account_id', msg.account_id)
          .eq('status', 'connected')
          .single()

        if (!session) {
          console.log(`[process-whatsapp-queue] No connected session for account ${msg.account_id}, skipping message ${msg.id}`)
          
          await supabase
            .from('whatsapp_message_queue')
            .update({ 
              status: 'failed',
              error_message: 'WhatsApp não conectado'
            })
            .eq('id', msg.id)
          
          errorCount++
          continue
        }

        // Before sending follow-up messages, check if lead has responded
        if (msg.followup_step_id && msg.lead_id) {
          const phoneSuffix = (msg.phone || '').replace(/\D/g, '').slice(-9)
          
          const { data: incomingByPhone } = await supabase
            .from('whatsapp_messages')
            .select('id')
            .eq('account_id', msg.account_id)
            .eq('is_from_me', false)
            .ilike('phone', `%${phoneSuffix}%`)
            .limit(1)

          const { data: incomingByLeadId } = await supabase
            .from('whatsapp_messages')
            .select('id')
            .eq('account_id', msg.account_id)
            .eq('lead_id', msg.lead_id)
            .eq('is_from_me', false)
            .limit(1)

          const leadHasResponded = (incomingByPhone && incomingByPhone.length > 0) ||
                                   (incomingByLeadId && incomingByLeadId.length > 0)

          if (leadHasResponded) {
            const detectedBy = (incomingByPhone?.length > 0) ? 'phone suffix' : 'lead_id (@lid)'
            console.log(`[process-whatsapp-queue] Lead ${msg.lead_id} already responded (detected by ${detectedBy}), cancelling follow-up ${msg.id}`)
            
            await supabase
              .from('whatsapp_message_queue')
              .update({ 
                status: 'cancelled',
                error_message: `Cancelado: lead respondeu (detectado por ${detectedBy})`
              })
              .eq('lead_id', msg.lead_id)
              .eq('status', 'pending')
              .not('followup_step_id', 'is', null)
            
            continue
          }
        }

        // Compose message with template variables
        let message = msg.message || ''
        if (msg.whatsapp_templates?.template) {
          message = msg.whatsapp_templates.template
        }
        
        // Replace variables
        const lead = msg.leads
        if (lead) {
          message = message
            .replace(/{nome}/gi, lead.name || '')
            .replace(/{telefone}/gi, lead.phone || '')
            .replace(/{email}/gi, lead.email || '')
        }

        // Get property info if linked
        if (msg.lead_id) {
          const { data: leadData } = await supabase
            .from('leads')
            .select('property_id, properties(title)')
            .eq('id', msg.lead_id)
            .single()
          
          if (leadData?.properties) {
            message = message.replace(/{imovel}/gi, (leadData.properties as { title: string }).title || '')
          } else {
            message = message.replace(/{imovel}/gi, '')
          }
        }

        // Get broker and company info
        if (msg.account_id) {
          const { data: leadWithBroker } = await supabase
            .from('leads')
            .select('assigned_broker_id, profiles!leads_assigned_broker_id_fkey(full_name)')
            .eq('id', msg.lead_id)
            .single()
          
          if (leadWithBroker?.profiles) {
            message = message.replace(/{corretor}/gi, (leadWithBroker.profiles as { full_name: string }).full_name || '')
          } else {
            message = message.replace(/{corretor}/gi, '')
          }

          const { data: account } = await supabase
            .from('accounts')
            .select('name, company_name')
            .eq('id', msg.account_id)
            .single()
          
          if (account) {
            message = message.replace(/{empresa}/gi, account.company_name || account.name || '')
          } else {
            message = message.replace(/{empresa}/gi, '')
          }
        }

        // Replace {form_*} variables from lead_form_field_values
        if (msg.lead_id && message.includes('{form_')) {
          const formVarMatches = message.match(/\{form_[^}]+\}/gi)
          if (formVarMatches) {
            const { data: formFields } = await supabase
              .from('lead_form_field_values')
              .select('field_name, field_value')
              .eq('lead_id', msg.lead_id)

            if (formFields && formFields.length > 0) {
              for (const match of formVarMatches) {
                const fieldName = match.slice(6, -1)
                const found = formFields.find(f => {
                  const normalize = (s: string) => s.toLowerCase().replace(/\?/g, '').replace(/_/g, ' ').trim()
                  return normalize(f.field_name) === normalize(fieldName)
                })
                message = message.replace(new RegExp(match.replace(/[{}?]/g, (c) => `\\${c}`), 'gi'), found?.field_value || '')
              }
            } else {
              const { data: customFields } = await supabase
                .from('lead_custom_field_values')
                .select('value, custom_fields(field_key)')
                .eq('lead_id', msg.lead_id)

              if (customFields && customFields.length > 0) {
                const normalizeStr = (s: string) => s.toLowerCase().replace(/\?/g, '').replace(/_/g, ' ').trim()
                for (const match of formVarMatches) {
                  const fieldName = match.slice(6, -1)
                  const found = customFields.find(f =>
                    normalizeStr((f.custom_fields as any)?.field_key || '') === normalizeStr(fieldName)
                  )
                  message = message.replace(new RegExp(match.replace(/[{}?]/g, (c) => `\\${c}`), 'gi'), found?.value || '')
                }
              } else {
                for (const match of formVarMatches) {
                  message = message.replace(new RegExp(match.replace(/[{}?]/g, (c) => `\\${c}`), 'gi'), '')
                }
              }
            }
          }
        }

        // Format phone number properly
        let phone = msg.phone || lead?.phone || ''
        const formattedPhone = formatPhoneForEvolution(phone)

        console.log(`[process-whatsapp-queue] Processing message ${msg.id} to ${phone} -> ${formattedPhone}`)

        // Call whatsapp-send function via HTTP
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

        // If number is invalid (no WhatsApp), mark as permanently failed
        if (sendResult.invalid_number) {
          console.log(`[process-whatsapp-queue] Invalid number for message ${msg.id}: ${sendResult.error}`)
          
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

        // Update queue status to sent
        await supabase
          .from('whatsapp_message_queue')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', msg.id)

        processedCount++
        console.log(`[process-whatsapp-queue] Message ${msg.id} sent successfully`)

        // After successfully sending a greeting, schedule follow-up messages
        if (msg.automation_rule_id && !msg.followup_step_id) {
          try {
            const { data: existingSequenceMsgs } = await supabase
              .from('whatsapp_message_queue')
              .select('id')
              .eq('lead_id', msg.lead_id)
              .eq('automation_rule_id', msg.automation_rule_id)
              .is('followup_step_id', null)
              .neq('id', msg.id)
              .limit(1)

            if (existingSequenceMsgs && existingSequenceMsgs.length > 0) {
              console.log(`[process-whatsapp-queue] Greeting sequence detected for lead ${msg.lead_id}, skipping follow-up scheduling`)
            } else {
              // ── Safety net: enqueue missing greeting sequence steps ──────
              const { data: sequenceSteps } = await supabase
                .from('whatsapp_greeting_sequence_steps')
                .select('*')
                .eq('automation_rule_id', msg.automation_rule_id)
                .eq('is_active', true)
                .order('position')

              if (sequenceSteps && sequenceSteps.length > 0) {
                // Check if sequence messages already exist in queue for this lead+rule
                const { data: existingSeqInQueue } = await supabase
                  .from('whatsapp_message_queue')
                  .select('id')
                  .eq('lead_id', msg.lead_id)
                  .eq('automation_rule_id', msg.automation_rule_id)
                  .neq('id', msg.id)
                  .limit(1)

                if (!existingSeqInQueue || existingSeqInQueue.length === 0) {
                  // No sequence messages found — enqueue positions 2+ as safety net
                  const remainingSteps = sequenceSteps.filter((s: any) => s.position > 1)
                  if (remainingSteps.length > 0) {
                    const seqSchedule = await getScheduleForAccount(msg.account_id)
                    const seqNow = Date.now()
                    const seqInserts = remainingSteps.map((step: any) => {
                      const rawMs = seqNow + step.delay_seconds * 1000
                      const scheduledMs = seqSchedule?.is_enabled
                        ? getNextValidSendTime(rawMs, seqSchedule)
                        : rawMs
                      return {
                        account_id: msg.account_id,
                        lead_id: msg.lead_id,
                        phone: msg.phone,
                        message: '',
                        template_id: step.template_id,
                        automation_rule_id: msg.automation_rule_id,
                        scheduled_for: new Date(scheduledMs).toISOString(),
                        status: 'pending',
                      }
                    })
                    const { error: seqInsertErr } = await supabase
                      .from('whatsapp_message_queue')
                      .insert(seqInserts)
                    if (seqInsertErr) {
                      console.error(`[process-whatsapp-queue] Error enqueuing sequence safety-net for lead ${msg.lead_id}:`, seqInsertErr)
                    } else {
                      console.log(`[process-whatsapp-queue] Safety-net: enqueued ${remainingSteps.length} sequence steps for lead ${msg.lead_id}`)
                    }
                  }
                }
              }
              // ── End safety net ──────────────────────────────────────────

              const { data: rule } = await supabase
                .from('whatsapp_automation_rules')
                .select('trigger_type')
                .eq('id', msg.automation_rule_id)
                .single()

              if (rule?.trigger_type === 'new_lead') {
                const { data: followUpSteps } = await supabase
                  .from('whatsapp_followup_steps')
                  .select('*')
                  .eq('account_id', msg.account_id)
                  .eq('is_active', true)
                  .order('position')

                if (followUpSteps && followUpSteps.length > 0) {
                  const now = Date.now()
                  
                  // Fetch schedule once for follow-up calculations
                  const fuSchedule = await getScheduleForAccount(msg.account_id)

                  // Sequential calculation: each follow-up is based on the
                  // adjusted time of the previous one, not independently from "now".
                  // delay_minutes are absolute (1440, 2880, 4320), so we compute deltas.
                  const followUpInserts: any[] = []
                  let lastScheduledMs = now
                  let previousDelayMinutes = 0

                  for (const step of followUpSteps as any[]) {
                    const deltaMinutes = step.delay_minutes - previousDelayMinutes
                    const rawScheduledMs = lastScheduledMs + deltaMinutes * 60 * 1000
                    const scheduledMs = fuSchedule?.is_enabled
                      ? getNextValidSendTime(rawScheduledMs, fuSchedule)
                      : rawScheduledMs

                    followUpInserts.push({
                      account_id: msg.account_id,
                      lead_id: msg.lead_id,
                      phone: msg.phone,
                      message: '',
                      template_id: step.template_id,
                      followup_step_id: step.id,
                      automation_rule_id: msg.automation_rule_id,
                      scheduled_for: new Date(scheduledMs).toISOString(),
                      status: 'pending',
                    })

                    lastScheduledMs = scheduledMs
                    previousDelayMinutes = step.delay_minutes
                  }

                  const { error: insertError } = await supabase
                    .from('whatsapp_message_queue')
                    .insert(followUpInserts)

                  if (insertError) {
                    console.error(`[process-whatsapp-queue] Error scheduling follow-ups for lead ${msg.lead_id}:`, insertError)
                  } else {
                    const scheduled = followUpInserts.map((f, i) => `FU${i+1}=${f.scheduled_for}`).join(', ')
                    console.log(`[process-whatsapp-queue] Scheduled ${followUpSteps.length} sequential follow-ups for lead ${msg.lead_id}: ${scheduled}`)
                  }
                }
              }
            }
          } catch (fuError) {
            console.error(`[process-whatsapp-queue] Error checking follow-up scheduling:`, fuError)
          }
        }

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
        } else {
          await supabase
            .from('whatsapp_message_queue')
            .update({ 
              retry_count: newRetryCount,
              error_message: errorMessage,
              scheduled_for: new Date(Date.now() + 5 * 60 * 1000).toISOString()
            })
            .eq('id', msg.id)
        }
        
        errorCount++
      }
    }

    console.log(`[process-whatsapp-queue] Completed: ${processedCount} sent, ${errorCount} errors`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: processedCount, 
        errors: errorCount,
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
