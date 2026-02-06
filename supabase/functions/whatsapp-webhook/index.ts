import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json()
    console.log('[whatsapp-webhook] Received event:', JSON.stringify(body).substring(0, 500))

    const { event, instance, data } = body

    if (!instance) {
      console.log('[whatsapp-webhook] No instance in payload')
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find session by instance name
    const { data: session, error: sessionError } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('instance_name', instance)
      .maybeSingle()

    if (sessionError || !session) {
      console.log('[whatsapp-webhook] Session not found for instance:', instance)
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    switch (event) {
      case 'connection.update': {
        console.log('[whatsapp-webhook] Connection update:', data)
        
        const { state, statusReason } = data || {}
        let newStatus = session.status

        if (state === 'open') {
          newStatus = 'connected'
        } else if (state === 'close' || state === 'connecting') {
          newStatus = state === 'connecting' ? 'connecting' : 'disconnected'
        }

        if (newStatus !== session.status) {
          await supabase
            .from('whatsapp_sessions')
            .update({ 
              status: newStatus,
              connected_at: newStatus === 'connected' ? new Date().toISOString() : session.connected_at,
              updated_at: new Date().toISOString()
            })
            .eq('id', session.id)
          
          console.log(`[whatsapp-webhook] Updated session status: ${session.status} -> ${newStatus}`)
        }
        break
      }

      case 'qrcode.updated': {
        console.log('[whatsapp-webhook] QR code updated')
        
        const { qrcode } = data || {}
        if (qrcode?.base64) {
          await supabase
            .from('whatsapp_sessions')
            .update({ 
              qr_code: qrcode.base64,
              qr_code_expires_at: new Date(Date.now() + 60000).toISOString(),
              status: 'qr_ready',
              updated_at: new Date().toISOString()
            })
            .eq('id', session.id)
        }
        break
      }

      case 'messages.upsert': {
        console.log('[whatsapp-webhook] Message event:', data)
        
        // Handle incoming messages if needed
        // For now, we just log them
        const messages = data?.messages || []
        for (const msg of messages) {
          if (msg.key?.fromMe) {
            // Outgoing message - update delivery status
            const messageId = msg.key?.id
            if (messageId) {
              await supabase
                .from('whatsapp_message_log')
                .update({ 
                  delivery_status: msg.status === 2 ? 'delivered' : 
                                   msg.status === 3 ? 'read' : 'sent'
                })
                .eq('message_id', messageId)
            }
          }
        }
        break
      }

      case 'messages.update': {
        console.log('[whatsapp-webhook] Message update event')
        
        // Update message delivery status
        const updates = data || []
        for (const update of updates) {
          const messageId = update.key?.id
          const status = update.update?.status
          
          if (messageId && status) {
            const deliveryStatus = status === 2 ? 'delivered' : 
                                   status === 3 ? 'read' : 
                                   status === 4 ? 'played' : 'sent'
            
            await supabase
              .from('whatsapp_message_log')
              .update({ delivery_status: deliveryStatus })
              .eq('message_id', messageId)
          }
        }
        break
      }

      default:
        console.log(`[whatsapp-webhook] Unhandled event: ${event}`)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[whatsapp-webhook] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
