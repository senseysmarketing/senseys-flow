import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function handleConnectionUpdate(supabase: any, session: any, data: any, instance: string) {
  const { state } = data || {}
  let newStatus = session.status

  if (state === 'open') {
    newStatus = 'connected'
    
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
        
        const owner = instanceData[0]?.instance?.owner
        if (owner) {
          const phoneRaw = owner.split('@')[0]
          if (phoneRaw.length >= 12) {
            const countryCode = phoneRaw.slice(0, 2)
            const areaCode = phoneRaw.slice(2, 4)
            const firstPart = phoneRaw.slice(4, 9)
            const secondPart = phoneRaw.slice(9)
            phoneNumber = `+${countryCode} (${areaCode}) ${firstPart}-${secondPart}`
          } else {
            phoneNumber = `+${phoneRaw}`
          }
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
    
    console.log(`[whatsapp-webhook] Session connected, phone: ${phoneNumber}`)
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
    }
  }
}

async function handleQRCodeUpdated(supabase: any, session: any, data: any) {
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
}

function extractPhoneFromJid(jid: string): string {
  return jid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/[^0-9]/g, '')
}

function normalizeBrazilianJid(jid: string): string {
  const phone = extractPhoneFromJid(jid);
  // Brazilian numbers: country code (55) + DDD (2 digits) + number (8 or 9 digits)
  // If 12 digits (55 + DD + 8 digits), insert 9 after DDD to normalize
  if (phone.length === 12 && phone.startsWith('55')) {
    const ddd = phone.slice(2, 4);
    const number = phone.slice(4);
    const normalized = `55${ddd}9${number}`;
    const suffix = jid.includes('@') ? '@' + jid.split('@')[1] : '@s.whatsapp.net';
    console.log(`[whatsapp-webhook] Normalized Brazilian JID: ${jid} -> ${normalized}${suffix}`);
    return normalized + suffix;
  }
  return jid;
}

function extractMessageContent(msg: any): { content: string | null, mediaType: string, mediaUrl: string | null } {
  // Recursively unwrap ephemeral and viewOnce messages
  if (msg.message?.ephemeralMessage?.message) {
    return extractMessageContent({ ...msg, message: msg.message.ephemeralMessage.message })
  }
  if (msg.message?.viewOnceMessageV2?.message) {
    return extractMessageContent({ ...msg, message: msg.message.viewOnceMessageV2.message })
  }
  if (msg.message?.viewOnceMessage?.message) {
    return extractMessageContent({ ...msg, message: msg.message.viewOnceMessage.message })
  }
  // Skip protocol messages and reaction messages
  if (msg.message?.protocolMessage || msg.message?.reactionMessage) {
    return { content: null, mediaType: 'text', mediaUrl: null }
  }
  if (msg.message?.conversation) {
    return { content: msg.message.conversation, mediaType: 'text', mediaUrl: null }
  }
  if (msg.message?.extendedTextMessage?.text) {
    return { content: msg.message.extendedTextMessage.text, mediaType: 'text', mediaUrl: null }
  }
  if (msg.message?.imageMessage) {
    return { content: msg.message.imageMessage.caption || '📷 Imagem', mediaType: 'image', mediaUrl: msg.message.imageMessage.url || null }
  }
  if (msg.message?.audioMessage) {
    return { content: '🎤 Áudio', mediaType: 'audio', mediaUrl: msg.message.audioMessage.url || null }
  }
  if (msg.message?.videoMessage) {
    return { content: msg.message.videoMessage.caption || '🎥 Vídeo', mediaType: 'video', mediaUrl: msg.message.videoMessage.url || null }
  }
  if (msg.message?.documentMessage) {
    return { content: msg.message.documentMessage.fileName || '📎 Documento', mediaType: 'document', mediaUrl: msg.message.documentMessage.url || null }
  }
  if (msg.message?.stickerMessage) {
    return { content: '🏷️ Sticker', mediaType: 'sticker', mediaUrl: null }
  }
  return { content: null, mediaType: 'text', mediaUrl: null }
}

async function upsertConversation(supabase: any, accountId: string, remoteJid: string, phone: string, contactName: string | null, lastMessage: string | null, isFromMe: boolean, leadId: string | null) {
  // Try to update existing conversation
  const { data: existing } = await supabase
    .from('whatsapp_conversations')
    .select('id, unread_count')
    .eq('account_id', accountId)
    .eq('remote_jid', remoteJid)
    .maybeSingle()

  const now = new Date().toISOString()
  
  if (existing) {
    const updateData: any = {
      last_message: lastMessage?.substring(0, 500),
      last_message_at: now,
      last_message_is_from_me: isFromMe,
      updated_at: now,
    }
    if (contactName) updateData.contact_name = contactName
    if (leadId) updateData.lead_id = leadId
    if (!isFromMe) updateData.unread_count = (existing.unread_count || 0) + 1
    
    await supabase
      .from('whatsapp_conversations')
      .update(updateData)
      .eq('id', existing.id)
  } else {
    await supabase
      .from('whatsapp_conversations')
      .insert({
        account_id: accountId,
        remote_jid: remoteJid,
        phone,
        contact_name: contactName,
        last_message: lastMessage?.substring(0, 500),
        last_message_at: now,
        last_message_is_from_me: isFromMe,
        unread_count: isFromMe ? 0 : 1,
        lead_id: leadId,
      })
  }
}

async function findLeadByPhone(supabase: any, accountId: string, phone: string): Promise<string | null> {
  const phoneSuffix = phone.slice(-9)
  const { data: leads } = await supabase
    .from('leads')
    .select('id')
    .eq('account_id', accountId)
    .ilike('phone', `%${phoneSuffix}%`)
    .order('created_at', { ascending: false })
    .limit(1)
  
  return leads?.[0]?.id || null
}

async function handleMessagesUpsert(supabase: any, session: any, data: any) {
  // Log raw payload for debugging
  console.log('[whatsapp-webhook] messages.upsert raw data:', JSON.stringify(data).substring(0, 2000))
  
  // Accept different formats from Evolution API
  let messages: any[] = []
  if (Array.isArray(data)) {
    messages = data
  } else if (data?.messages && Array.isArray(data.messages)) {
    messages = data.messages
  } else if (data?.message && data?.key) {
    // Single message object with key and message properties at root
    messages = [data]
  } else if (data?.key) {
    messages = [data]
  }

  console.log(`[whatsapp-webhook] Processing ${messages.length} messages, parsed format: ${Array.isArray(data) ? 'array' : data?.messages ? 'data.messages' : data?.key ? 'single-object' : 'unknown'}`)

  if (messages.length === 0) {
    console.log('[whatsapp-webhook] No messages to process, raw data keys:', JSON.stringify(Object.keys(data || {})))
  }
  
  for (const msg of messages) {
    const rawRemoteJid = msg.key?.remoteJid
    if (!rawRemoteJid || rawRemoteJid.endsWith('@g.us') || rawRemoteJid === 'status@broadcast') continue

    // Normalize Brazilian JIDs to always include the 9th digit
    const remoteJid = normalizeBrazilianJid(rawRemoteJid)
    const phone = extractPhoneFromJid(remoteJid)
    if (!phone || phone.length < 8) continue

    const isFromMe = !!msg.key?.fromMe
    const messageId = msg.key?.id
    const contactName = msg.pushName || null
    const { content, mediaType, mediaUrl } = extractMessageContent(msg)
    
    if (!content && mediaType === 'text') continue // Skip empty messages

    // Find matching lead
    const leadId = await findLeadByPhone(supabase, session.account_id, phone)

    // Store the message
    await supabase
      .from('whatsapp_messages')
      .insert({
        account_id: session.account_id,
        remote_jid: remoteJid,
        phone,
        message_id: messageId,
        content,
        media_type: mediaType,
        media_url: mediaUrl,
        is_from_me: isFromMe,
        status: isFromMe ? 'sent' : 'received',
        timestamp: msg.messageTimestamp 
          ? new Date(typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp * 1000 : msg.messageTimestamp).toISOString()
          : new Date().toISOString(),
        lead_id: leadId,
        contact_name: contactName,
      })

    // Update/create conversation
    await upsertConversation(
      supabase, session.account_id, remoteJid, phone,
      contactName, content, isFromMe, leadId
    )

    // Update delivery status in message log (for outgoing)
    if (isFromMe && messageId) {
      await supabase
        .from('whatsapp_message_log')
        .update({ 
          delivery_status: msg.status === 2 ? 'delivered' : 
                           msg.status === 3 ? 'read' : 'sent'
        })
        .eq('message_id', messageId)
    }

    // Handle incoming message lead status changes (existing logic)
    if (!isFromMe) {
      const phoneSuffix = phone.slice(-9)

      const { data: matchedLeads } = await supabase
        .from('leads')
        .select('id, status_id, name')
        .eq('account_id', session.account_id)
        .ilike('phone', `%${phoneSuffix}%`)
        .order('created_at', { ascending: false })
        .limit(5)

      if (!matchedLeads || matchedLeads.length === 0) continue

      const { data: novoLeadStatus } = await supabase
        .from('lead_status')
        .select('id')
        .eq('account_id', session.account_id)
        .eq('name', 'Novo Lead')
        .maybeSingle()

      const { data: emContatoStatus } = await supabase
        .from('lead_status')
        .select('id')
        .eq('account_id', session.account_id)
        .eq('name', 'Em Contato')
        .maybeSingle()

      if (!novoLeadStatus || !emContatoStatus) continue

      // Cancel pending follow-ups for ALL matched leads
      for (const lead of matchedLeads) {
        const { data: cancelledMsgs } = await supabase
          .from('whatsapp_message_queue')
          .update({ status: 'cancelled' })
          .eq('lead_id', lead.id)
          .eq('status', 'pending')
          .not('followup_step_id', 'is', null)
          .select('id')

        if (cancelledMsgs?.length > 0) {
          console.log(`[whatsapp-webhook] Cancelled ${cancelledMsgs.length} follow-up(s) for lead ${lead.id}`)
        }
      }

      // Move "Novo Lead" -> "Em Contato"
      const leadsToMove = matchedLeads.filter(l => l.status_id === novoLeadStatus.id)
      for (const lead of leadsToMove) {
        const { error: updateError } = await supabase
          .from('leads')
          .update({ status_id: emContatoStatus.id })
          .eq('id', lead.id)

        if (updateError) continue

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

        console.log(`[whatsapp-webhook] Lead "${lead.name}" moved to "Em Contato"`)
      }
    }
  }
}

async function handleMessagesUpdate(supabase: any, data: any) {
  let updates: any[] = []
  if (Array.isArray(data)) {
    updates = data
  } else if (data && typeof data === 'object') {
    updates = [data]
  }
  for (const update of updates) {
    const messageId = update.key?.id
    const status = update.update?.status
    
    if (messageId && status) {
      const deliveryStatus = status === 2 ? 'delivered' : 
                             status === 3 ? 'read' : 
                             status === 4 ? 'played' : 'sent'
      
      // Update in message log
      await supabase
        .from('whatsapp_message_log')
        .update({ delivery_status: deliveryStatus })
        .eq('message_id', messageId)

      // Update in messages table
      await supabase
        .from('whatsapp_messages')
        .update({ status: deliveryStatus })
        .eq('message_id', messageId)
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json()
    console.log('[whatsapp-webhook] Event:', body.event, 'instance:', body.instance, 'data type:', typeof body.data, 'isArray:', Array.isArray(body.data))

    const { event, instance, data } = body

    // Normalize event name: MESSAGES_UPSERT -> messages.upsert, CONNECTION_UPDATE -> connection.update
    const normalizedEvent = event?.toLowerCase().replace(/_/g, '.')

    if (!instance) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: session, error: sessionError } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('instance_name', instance)
      .maybeSingle()

    if (sessionError || !session) {
      console.log('[whatsapp-webhook] Session not found for:', instance)
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    switch (normalizedEvent) {
      case 'connection.update':
        await handleConnectionUpdate(supabase, session, data, instance)
        break
      case 'qrcode.updated':
        await handleQRCodeUpdated(supabase, session, data)
        break
      case 'messages.upsert':
        console.log('[whatsapp-webhook] messages.upsert payload keys:', JSON.stringify(Object.keys(data || {})))
        await handleMessagesUpsert(supabase, session, data)
        break
      case 'messages.update':
        await handleMessagesUpdate(supabase, data)
        break
      case 'send.message':
        console.log('[whatsapp-webhook] send.message payload keys:', JSON.stringify(Object.keys(data || {})))
        await handleMessagesUpsert(supabase, session, data)
        break
      default:
        console.log(`[whatsapp-webhook] Unhandled event: ${event} (normalized: ${normalizedEvent})`)
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
