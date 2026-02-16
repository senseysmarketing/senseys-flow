import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Robust phone formatting for Evolution API
function formatPhoneForEvolution(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '')
  
  // If already starts with 55 and has proper length (12-13 digits), it's valid
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    return cleaned
  }
  
  // If has 10-11 digits (DDD + number without country code), add 55
  if (cleaned.length >= 10 && cleaned.length <= 11) {
    return '55' + cleaned
  }
  
  // Return as is (might be international or incomplete)
  return cleaned
}

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

    let processedCount = 0
    let errorCount = 0

    for (const msg of pendingMessages) {
      try {
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
          
          const { data: incomingMessages } = await supabase
            .from('whatsapp_messages')
            .select('id')
            .eq('account_id', msg.account_id)
            .eq('is_from_me', false)
            .ilike('phone', `%${phoneSuffix}%`)
            .limit(1)
          
          if (incomingMessages && incomingMessages.length > 0) {
            console.log(`[process-whatsapp-queue] Lead ${msg.lead_id} already responded, cancelling follow-up ${msg.id}`)
            
            // Cancel this and all remaining follow-ups for this lead
            await supabase
              .from('whatsapp_message_queue')
              .update({ status: 'cancelled' })
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
          // Get assigned broker name
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

          // Get company name
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

        // Format phone number properly
        let phone = msg.phone || lead?.phone || ''
        const formattedPhone = formatPhoneForEvolution(phone)

        console.log(`[process-whatsapp-queue] Processing message ${msg.id} to ${phone} -> ${formattedPhone}`)

        // Call whatsapp-send function via HTTP with internal call header
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

        // If number is invalid (no WhatsApp), mark as permanently failed - no retries
        if (sendResult.invalid_number) {
          console.log(`[process-whatsapp-queue] Invalid number for message ${msg.id}: ${sendResult.error}`)
          
          await supabase
            .from('whatsapp_message_queue')
            .update({ 
              status: 'failed',
              error_message: 'Este número não existe no WhatsApp',
              retry_count: 99 // Mark as permanently failed
            })
            .eq('id', msg.id)
          
          // Also cancel any pending follow-ups for this lead
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
            // Check if the automation rule is a new_lead greeting
            const { data: rule } = await supabase
              .from('whatsapp_automation_rules')
              .select('trigger_type')
              .eq('id', msg.automation_rule_id)
              .single()

            if (rule?.trigger_type === 'new_lead') {
              // Get active follow-up steps for this account
              const { data: followUpSteps } = await supabase
                .from('whatsapp_followup_steps')
                .select('*')
                .eq('account_id', msg.account_id)
                .eq('is_active', true)
                .order('position')

              if (followUpSteps && followUpSteps.length > 0) {
                const now = Date.now()
                const followUpInserts = followUpSteps.map((step: any) => ({
                  account_id: msg.account_id,
                  lead_id: msg.lead_id,
                  phone: msg.phone,
                  message: '', // Will be resolved by template at send time
                  template_id: step.template_id,
                  followup_step_id: step.id,
                  automation_rule_id: msg.automation_rule_id,
                  scheduled_for: new Date(now + step.delay_minutes * 60 * 1000).toISOString(),
                  status: 'pending',
                }))

                const { error: insertError } = await supabase
                  .from('whatsapp_message_queue')
                  .insert(followUpInserts)

                if (insertError) {
                  console.error(`[process-whatsapp-queue] Error scheduling follow-ups for lead ${msg.lead_id}:`, insertError)
                } else {
                  console.log(`[process-whatsapp-queue] Scheduled ${followUpSteps.length} follow-ups for lead ${msg.lead_id}`)
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
        
        // Increment retry count and mark as failed if too many retries
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
          // Reschedule for 5 minutes later
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
