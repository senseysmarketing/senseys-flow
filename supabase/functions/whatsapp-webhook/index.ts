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
          
          // Fetch instance info to get phone number
          const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || ''
          const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || ''
          
          let phoneNumber: string | null = null
          
          if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
            try {
              const apiUrl = EVOLUTION_API_URL.startsWith('http') 
                ? EVOLUTION_API_URL 
                : `https://${EVOLUTION_API_URL}`
              
              const instanceResponse = await fetch(
                `${apiUrl}/instance/fetchInstances?instanceName=${instance}`,
                { headers: { 'apikey': EVOLUTION_API_KEY } }
              )
              const instanceData = await instanceResponse.json()
              console.log('[whatsapp-webhook] Instance data:', JSON.stringify(instanceData).substring(0, 500))
              
              // Extract phone from owner field (format: 5516981057418@s.whatsapp.net)
              const owner = instanceData[0]?.instance?.owner
              if (owner) {
                const phoneRaw = owner.split('@')[0]
                // Format: +55 (16) 98105-7418
                if (phoneRaw.length >= 12) {
                  const countryCode = phoneRaw.slice(0, 2)
                  const areaCode = phoneRaw.slice(2, 4)
                  const firstPart = phoneRaw.slice(4, 9)
                  const secondPart = phoneRaw.slice(9)
                  phoneNumber = `+${countryCode} (${areaCode}) ${firstPart}-${secondPart}`
                } else {
                  phoneNumber = `+${phoneRaw}`
                }
                console.log(`[whatsapp-webhook] Phone number extracted: ${phoneNumber}`)
              }
            } catch (e) {
              console.log('[whatsapp-webhook] Could not fetch phone number:', e)
            }
          }
          
          await supabase
            .from('whatsapp_sessions')
            .update({ 
              status: newStatus,
              phone_number: phoneNumber,
              connected_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', session.id)
          
          console.log(`[whatsapp-webhook] Updated session status: ${session.status} -> ${newStatus}, phone: ${phoneNumber}`)
        } else if (state === 'close' || state === 'connecting') {
          newStatus = state === 'connecting' ? 'connecting' : 'disconnected'
          
          if (newStatus !== session.status) {
            await supabase
              .from('whatsapp_sessions')
              .update({ 
                status: newStatus,
                updated_at: new Date().toISOString()
              })
              .eq('id', session.id)
            
            console.log(`[whatsapp-webhook] Updated session status: ${session.status} -> ${newStatus}`)
          }
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
          } else {
            // Incoming message from lead - check if we should move to "Em Contato"
            const remoteJid = msg.key?.remoteJid
            if (!remoteJid || remoteJid.endsWith('@g.us')) {
              // Skip group messages
              continue
            }

            const senderPhone = remoteJid.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '')
            if (!senderPhone || senderPhone.length < 8) continue

            // Use last 8-9 digits for flexible matching
            const phoneSuffix = senderPhone.slice(-9)
            console.log(`[whatsapp-webhook] Incoming message from ${senderPhone}, suffix: ${phoneSuffix}`)

            // Find lead by phone in this account
            const { data: matchedLeads } = await supabase
              .from('leads')
              .select('id, status_id, name')
              .eq('account_id', session.account_id)
              .ilike('phone', `%${phoneSuffix}%`)
              .order('created_at', { ascending: false })
              .limit(5)

            if (!matchedLeads || matchedLeads.length === 0) {
              console.log(`[whatsapp-webhook] No lead found for phone suffix ${phoneSuffix}`)
              continue
            }

            // Get "Novo Lead" status for this account
            const { data: novoLeadStatus } = await supabase
              .from('lead_status')
              .select('id')
              .eq('account_id', session.account_id)
              .eq('name', 'Novo Lead')
              .maybeSingle()

            if (!novoLeadStatus) {
              console.log('[whatsapp-webhook] "Novo Lead" status not found for account')
              continue
            }

            // Get "Em Contato" status for this account
            const { data: emContatoStatus } = await supabase
              .from('lead_status')
              .select('id')
              .eq('account_id', session.account_id)
              .eq('name', 'Em Contato')
              .maybeSingle()

            if (!emContatoStatus) {
              console.log('[whatsapp-webhook] "Em Contato" status not found for account')
              continue
            }

            // Only move leads that are currently "Novo Lead"
            const leadsToMove = matchedLeads.filter(l => l.status_id === novoLeadStatus.id)

            if (leadsToMove.length === 0) {
              console.log(`[whatsapp-webhook] Lead(s) found but none in "Novo Lead" status - ignoring`)
              continue
            }

            // Cancel pending follow-ups for ALL matched leads (regardless of status)
            for (const lead of matchedLeads) {
              const { data: cancelledMsgs, error: cancelError } = await supabase
                .from('whatsapp_message_queue')
                .update({ status: 'cancelled' })
                .eq('lead_id', lead.id)
                .eq('status', 'pending')
                .not('followup_step_id', 'is', null)
                .select('id')

              if (!cancelError && cancelledMsgs && cancelledMsgs.length > 0) {
                console.log(`[whatsapp-webhook] Cancelled ${cancelledMsgs.length} follow-up(s) for lead ${lead.id}`)
              }
            }

            for (const lead of leadsToMove) {
              const { error: updateError } = await supabase
                .from('leads')
                .update({ status_id: emContatoStatus.id })
                .eq('id', lead.id)

              if (updateError) {
                console.error(`[whatsapp-webhook] Error updating lead ${lead.id}:`, updateError)
                continue
              }

              // Log activity
              await supabase
                .from('lead_activities')
                .insert({
                  lead_id: lead.id,
                  account_id: session.account_id,
                  activity_type: 'status_changed',
                  description: 'Lead respondeu via WhatsApp - movido automaticamente para Em Contato',
                  old_value: 'Novo Lead',
                  new_value: 'Em Contato',
                })

              console.log(`[whatsapp-webhook] Lead "${lead.name}" (${lead.id}) moved from "Novo Lead" to "Em Contato"`)
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
