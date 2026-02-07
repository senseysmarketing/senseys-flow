import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

        // Format phone number
        let phone = msg.phone || lead?.phone || ''
        phone = phone.replace(/\D/g, '')
        if (phone.length <= 11) {
          phone = '55' + phone
        }

        console.log(`[process-whatsapp-queue] Sending message to ${phone} via instance ${session.instance_name}`)

        // Call whatsapp-send function
        const sendResult = await supabase.functions.invoke('whatsapp-send', {
          body: {
            phone: phone,
            message: message,
            lead_id: msg.lead_id,
            template_id: msg.template_id
          }
        })

        if (sendResult.error) {
          throw new Error(sendResult.error.message || 'Failed to send message')
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
