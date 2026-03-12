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
    // Guard: if session is already 'connected' and we get 'connecting', 
    // verify with Evolution before downgrading (avoids stale status from transient events)
    if (state === 'connecting' && session.status === 'connected') {
      const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || ''
      const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || ''
      if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
        try {
          const apiUrl = EVOLUTION_API_URL.startsWith('http') ? EVOLUTION_API_URL : `https://${EVOLUTION_API_URL}`
          const stateResp = await fetch(
            `${apiUrl}/instance/connectionState/${instance}`,
            { headers: { 'apikey': EVOLUTION_API_KEY } }
          )
          const stateData = await stateResp.json()
          const realState = stateData?.instance?.state || stateData?.state
          if (realState === 'open') {
            console.log(`[whatsapp-webhook] Ignoring transient 'connecting' for ${instance} — Evolution confirms 'open'`)
            return // Don't downgrade
          }
        } catch (e) {
          console.log(`[whatsapp-webhook] Could not verify state for ${instance}, allowing downgrade:`, e)
        }
      }
    }

    newStatus = state === 'connecting' ? 'connecting' : 'disconnected'
    
    if (newStatus !== session.status) {
      console.log(`[whatsapp-webhook] Session ${instance} status transition: ${session.status} -> ${newStatus}`)
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
  if (msg.message?.ephemeralMessage?.message) {
    return extractMessageContent({ ...msg, message: msg.message.ephemeralMessage.message })
  }
  if (msg.message?.viewOnceMessageV2?.message) {
    return extractMessageContent({ ...msg, message: msg.message.viewOnceMessageV2.message })
  }
  if (msg.message?.viewOnceMessage?.message) {
    return extractMessageContent({ ...msg, message: msg.message.viewOnceMessage.message })
  }
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

async function upsertConversation(supabase: any, accountId: string, remoteJid: string, phone: string, contactName: string | null, lastMessage: string | null, isFromMe: boolean, leadId: string | null, lidJid?: string | null, sessionPhone?: string | null, wasInserted: boolean = true, messageTimestamp?: string | null) {
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
    if (!isFromMe) updateData.last_customer_message_at = messageTimestamp || now
    if (contactName) updateData.contact_name = contactName
    if (leadId) updateData.lead_id = leadId
    if (!isFromMe && wasInserted) updateData.unread_count = (existing.unread_count || 0) + 1
    if (lidJid) updateData.lid_jid = lidJid
    if (sessionPhone) updateData.session_phone = sessionPhone
    
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
        last_customer_message_at: !isFromMe ? (messageTimestamp || now) : null,
        unread_count: isFromMe ? 0 : 1,
        lead_id: leadId,
        lid_jid: lidJid || null,
        session_phone: sessionPhone || null,
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

async function resolveLidToPhone(instanceName: string, lidJid: string): Promise<string | null> {
  const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || ''
  const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || ''
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) return null

  const apiUrl = EVOLUTION_API_URL.startsWith('http') ? EVOLUTION_API_URL : `https://${EVOLUTION_API_URL}`
  try {
    const res = await fetch(`${apiUrl}/chat/findContacts/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
      body: JSON.stringify({ where: { id: lidJid } })
    })
    const contacts = await res.json()
    console.log(`[whatsapp-webhook] findContacts response for ${lidJid}:`, JSON.stringify(contacts).substring(0, 500))
    const contact = Array.isArray(contacts) ? contacts[0] : contacts
    const phoneJid = contact?.id || contact?.jid || contact?.remoteJid
    if (phoneJid && phoneJid.includes('@s.whatsapp.net')) {
      return normalizeBrazilianJid(phoneJid)
    }
  } catch (e) {
    console.error('[whatsapp-webhook] findContacts error:', e)
  }
  return null
}

async function handleMessagesUpsert(supabase: any, session: any, data: any, instanceName: string) {
  console.log('[whatsapp-webhook] messages.upsert raw data:', JSON.stringify(data).substring(0, 2000))

  // Auto-repair: if messages are flowing but session status is not 'connected', fix it
  if (session.status !== 'connected') {
    console.log(`[whatsapp-webhook] Message traffic on ${instanceName} but status is '${session.status}' — auto-syncing to 'connected'`)
    await supabase
      .from('whatsapp_sessions')
      .update({ 
        status: 'connected',
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id)
    session.status = 'connected'
  }
  
  let messages: any[] = []
  if (Array.isArray(data)) {
    messages = data
  } else if (data?.messages && Array.isArray(data.messages)) {
    messages = data.messages
  } else if (data?.message && data?.key) {
    messages = [data]
  } else if (data?.key) {
    messages = [data]
  }

  console.log(`[whatsapp-webhook] Processing ${messages.length} messages`)

  if (messages.length === 0) {
    console.log('[whatsapp-webhook] No messages to process, raw data keys:', JSON.stringify(Object.keys(data || {})))
  }
  
  for (const msg of messages) {
    const rawRemoteJid = msg.key?.remoteJid
    if (!rawRemoteJid || rawRemoteJid.endsWith('@g.us') || rawRemoteJid === 'status@broadcast') continue

    const isLid = rawRemoteJid.endsWith('@lid')
    const isFromMe = !!msg.key?.fromMe
    const messageId = msg.key?.id
    const contactName = msg.pushName || null
    const { content, mediaType, mediaUrl } = extractMessageContent(msg)
    
    if (!content && mediaType === 'text') continue

    // --- @lid resolution logic ---
    let resolvedJid: string | null = null
    let resolvedPhone: string | null = null
    let lidJidForConversation: string | null = null

    if (isLid) {
      // 1. Try to resolve via Evolution API findContacts
      resolvedJid = await resolveLidToPhone(instanceName, rawRemoteJid)
      
      // 2. Fallback: check if we have a mapping in the DB
      if (!resolvedJid) {
        const { data: mappedConv } = await supabase
          .from('whatsapp_conversations')
          .select('remote_jid')
          .eq('account_id', session.account_id)
          .eq('lid_jid', rawRemoteJid)
          .maybeSingle()
        
        if (mappedConv?.remote_jid) {
          resolvedJid = mappedConv.remote_jid
          console.log(`[whatsapp-webhook] Resolved @lid via DB mapping: ${rawRemoteJid} -> ${resolvedJid}`)
        }
      } else {
        console.log(`[whatsapp-webhook] Resolved @lid via findContacts: ${rawRemoteJid} -> ${resolvedJid}`)
      }

      // 3. Fallback: try matching by pushName to find the lead and its conversation
      if (!resolvedJid && contactName) {
        const { data: leadByName } = await supabase
          .from('leads')
          .select('id, phone')
          .eq('account_id', session.account_id)
          .ilike('name', `%${contactName}%`)
          .order('created_at', { ascending: false })
          .limit(1)
        
        if (leadByName?.[0]?.phone) {
          const leadPhone = leadByName[0].phone.replace(/[^0-9]/g, '')
          const normalizedLeadJid = normalizeBrazilianJid(`${leadPhone}@s.whatsapp.net`)
          // Verify this conversation exists
          const { data: existingConv } = await supabase
            .from('whatsapp_conversations')
            .select('remote_jid')
            .eq('account_id', session.account_id)
            .eq('remote_jid', normalizedLeadJid)
            .maybeSingle()
          
          if (existingConv) {
            resolvedJid = normalizedLeadJid
            console.log(`[whatsapp-webhook] Resolved @lid via lead name "${contactName}": ${rawRemoteJid} -> ${resolvedJid}`)
          }
        }
      }

      lidJidForConversation = rawRemoteJid
    }

    // Determine final JID and phone to use
    const finalJid = resolvedJid || (isLid ? rawRemoteJid : normalizeBrazilianJid(rawRemoteJid))
    const finalPhone = isLid
      ? (resolvedJid ? extractPhoneFromJid(resolvedJid) : rawRemoteJid.replace('@lid', ''))
      : extractPhoneFromJid(finalJid)
    
    if (!finalPhone || (!isLid && !resolvedJid && finalPhone.length < 8)) continue

    // If @lid resolved, save the mapping on the conversation
    if (isLid && resolvedJid) {
      lidJidForConversation = rawRemoteJid
    }

    // Extract previousRemoteJid from incoming messages to build @lid mapping
    const previousRemoteJid = msg.key?.previousRemoteJid
    if (previousRemoteJid && previousRemoteJid.endsWith('@lid') && !isLid) {
      // This incoming message tells us the @lid for this contact
      const normalizedIncomingJid = normalizeBrazilianJid(rawRemoteJid)
      await supabase
        .from('whatsapp_conversations')
        .update({ lid_jid: previousRemoteJid })
        .eq('account_id', session.account_id)
        .eq('remote_jid', normalizedIncomingJid)
      console.log(`[whatsapp-webhook] Saved @lid mapping from previousRemoteJid: ${normalizedIncomingJid} -> ${previousRemoteJid}`)
    }

    // Find matching lead
    let leadId: string | null = null
    let lidResolvedLeadId: string | null = null // track if we resolved lead via @lid name match

    if (isLid && !resolvedJid && contactName) {
      // For unresolved @lid, try to find lead by pushName
      const { data: leadByName } = await supabase
        .from('leads')
        .select('id, phone')
        .eq('account_id', session.account_id)
        .ilike('name', `%${contactName}%`)
        .order('created_at', { ascending: false })
        .limit(1)
      leadId = leadByName?.[0]?.id || null
      if (leadId) {
        lidResolvedLeadId = leadId
        console.log(`[whatsapp-webhook] Found lead ${leadId} for @lid via pushName "${contactName}"`)

        // Save lid_jid to the existing conversation for this lead so future @lid messages resolve correctly
        await supabase
          .from('whatsapp_conversations')
          .update({ lid_jid: rawRemoteJid })
          .eq('account_id', session.account_id)
          .eq('lead_id', leadId)
          .is('lid_jid', null) // only update if not already set
        console.log(`[whatsapp-webhook] Saved lid_jid ${rawRemoteJid} to conversation for lead ${leadId}`)

        // Immediately cancel pending follow-ups for this lead since they responded
        const { data: cancelledMsgs, error: cancelErr } = await supabase
          .from('whatsapp_message_queue')
          .update({
            status: 'cancelled',
            error_message: 'Cancelado: lead respondeu via @lid (identificado por nome)'
          })
          .eq('lead_id', leadId)
          .eq('status', 'pending')
          .not('followup_step_id', 'is', null)
          .select('id')
        if (cancelErr) {
          console.warn(`[whatsapp-webhook] Failed to cancel follow-ups for lead ${leadId} (@lid name resolution):`, cancelErr)
        } else if (cancelledMsgs?.length > 0) {
          console.log(`[whatsapp-webhook] Cancelled ${cancelledMsgs.length} follow-up(s) for lead ${leadId} (via @lid name resolution)`)
        }

        // NEW: Mark automation control as responded (state machine)
        await supabase
          .from('whatsapp_automation_control')
          .update({ status: 'responded', updated_at: new Date().toISOString() })
          .eq('lead_id', leadId)
          .in('status', ['active', 'processing'])
      }
    } else {
      leadId = await findLeadByPhone(supabase, session.account_id, finalPhone)
    }

    // Store the message with the resolved JID (not the @lid) — atomic idempotent insert
    const storeJid = (isLid && resolvedJid) ? resolvedJid : finalJid
    
    // Guard: ensure message_id is never NULL to prevent silent duplicate inserts
    const safeMessageId = messageId ?? `${instanceName}-${Date.now()}-${crypto.randomUUID().slice(0,8)}`
    
    // Calculate message timestamp for conversation state
    const messageTimestamp = msg.messageTimestamp 
      ? new Date(typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp * 1000 : msg.messageTimestamp).toISOString()
      : new Date().toISOString()
    
    const { data: inserted } = await supabase
      .from('whatsapp_messages')
      .upsert({
        account_id: session.account_id,
        remote_jid: storeJid,
        phone: finalPhone,
        message_id: safeMessageId,
        content,
        media_type: mediaType,
        media_url: mediaUrl,
        is_from_me: isFromMe,
        status: isFromMe ? 'sent' : 'received',
        timestamp: messageTimestamp,
        lead_id: leadId,
        contact_name: contactName,
        session_phone: session.phone_number || null,
      }, { onConflict: 'account_id,message_id', ignoreDuplicates: true })
      .select('id')

    const wasInserted = (inserted?.length ?? 0) > 0

    if (!wasInserted && messageId) {
      console.log('[whatsapp-webhook] Duplicate message skipped (ON CONFLICT):', messageId)
    }

    // Update/create conversation
    if (!isLid || resolvedJid) {
      await upsertConversation(
        supabase, session.account_id, storeJid, finalPhone,
        contactName, content, isFromMe, leadId, lidJidForConversation, session.phone_number || null, wasInserted, messageTimestamp
      )
    } else if (lidResolvedLeadId) {
      // @lid not resolved via API/DB mapping, but resolved by lead name.
      // Update the existing conversation for this lead so the message is visible.
      const { data: existingLeadConv } = await supabase
        .from('whatsapp_conversations')
        .select('remote_jid, phone')
        .eq('account_id', session.account_id)
        .eq('lead_id', lidResolvedLeadId)
        .maybeSingle()

      if (existingLeadConv) {
        await upsertConversation(
          supabase, session.account_id, existingLeadConv.remote_jid, existingLeadConv.phone,
          contactName, content, isFromMe, lidResolvedLeadId, rawRemoteJid, session.phone_number || null, wasInserted, messageTimestamp
        )
        console.log(`[whatsapp-webhook] Updated conversation for @lid lead ${lidResolvedLeadId} via name resolution`)
      } else {
        console.log(`[whatsapp-webhook] Skipping conversation upsert for unresolved @lid: ${rawRemoteJid} (no existing conversation found)`)
      }
    } else {
      console.log(`[whatsapp-webhook] Skipping conversation upsert for unresolved @lid: ${rawRemoteJid}`)
    }

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

    // Handle incoming message lead status changes
    // Also handle resolved @lid messages (isLid=true but resolvedJid is set)
    // The isLid && !resolvedJid && contactName case is already handled above (lead found by name)
    if (!isFromMe && (!isLid || resolvedJid)) {
      // Prefer the lead already resolved by findLeadByPhone (exact account match).
      // Only fall back to phone-suffix ILIKE search when leadId is not yet known,
      // to avoid cancelling follow-ups for multiple leads sharing the same phone suffix.
      let matchedLeads: any[] = []

      if (leadId) {
        const { data: exactLead } = await supabase
          .from('leads')
          .select('id, status_id, name')
          .eq('id', leadId)
          .maybeSingle()
        if (exactLead) matchedLeads = [exactLead]
      } else {
        const phoneSuffix = finalPhone.slice(-9)
        const { data: leads } = await supabase
          .from('leads')
          .select('id, status_id, name')
          .eq('account_id', session.account_id)
          .ilike('phone', `%${phoneSuffix}%`)
          .order('created_at', { ascending: false })
          .limit(5)
        matchedLeads = leads || []
      }

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

      for (const lead of matchedLeads) {
        const { data: cancelledMsgs, error: cancelErr } = await supabase
          .from('whatsapp_message_queue')
          .update({ status: 'cancelled', error_message: 'Cancelado: lead respondeu via WhatsApp' })
          .eq('lead_id', lead.id)
          .eq('status', 'pending')
          .not('followup_step_id', 'is', null)
          .select('id')

        if (cancelErr) {
          console.warn(`[whatsapp-webhook] Failed to cancel follow-ups for lead ${lead.id}:`, cancelErr)
        } else if (cancelledMsgs?.length > 0) {
          console.log(`[whatsapp-webhook] Cancelled ${cancelledMsgs.length} follow-up(s) for lead ${lead.id}`)
        }

        // NEW: Mark automation control as responded (state machine)
        const { data: controlUpdated } = await supabase
          .from('whatsapp_automation_control')
          .update({ status: 'responded', updated_at: new Date().toISOString() })
          .eq('lead_id', lead.id)
          .in('status', ['active', 'processing'])
          .select('id')

        if (controlUpdated?.length > 0) {
          console.log(`[whatsapp-webhook] Marked ${controlUpdated.length} automation control(s) as responded for lead ${lead.id}`)
        }
      }

      const leadsToMove = matchedLeads.filter(l => l.status_id === novoLeadStatus.id)
      for (const lead of leadsToMove) {
        const { error: updateError } = await supabase
          .from('leads')
          .update({ status_id: emContatoStatus.id })
          .eq('id', lead.id)

        if (updateError) {
          console.warn(`[whatsapp-webhook] Failed to update lead status for ${lead.id}:`, updateError)
          continue
        }

        const { error: activityError } = await supabase
          .from('lead_activities')
          .insert({
            lead_id: lead.id,
            account_id: session.account_id,
            activity_type: 'status_changed',
            description: 'Lead respondeu via WhatsApp - movido automaticamente para Em Contato',
            old_value: 'Novo Lead',
            new_value: 'Em Contato',
          })

        if (activityError) {
          // Status was already updated — log the missing audit trail but do not revert
          console.warn(`[whatsapp-webhook] Lead ${lead.id} moved to "Em Contato" but activity insert failed:`, activityError)
        } else {
          console.log(`[whatsapp-webhook] Lead "${lead.name}" moved to "Em Contato"`)
        }
      }
    }
  }
}

// Status rank map — higher rank = more advanced delivery state.
// Updates are only applied when the new status has a strictly higher rank,
// preventing delivery status regression (e.g. 'read' -> 'delivered' -> 'sent').
const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3, played: 4 }

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

      const newRank = STATUS_RANK[deliveryStatus] ?? 0
      // Only allow advancing to a higher-ranked status (forward-only transitions)
      const lowerStatuses = Object.keys(STATUS_RANK).filter(s => (STATUS_RANK[s] ?? 0) < newRank)

      await supabase
        .from('whatsapp_message_log')
        .update({ delivery_status: deliveryStatus })
        .eq('message_id', messageId)
        // message_log may not have a status column to filter on, so update unconditionally

      if (lowerStatuses.length > 0) {
        // Advance status only if current status is lower (prevents regression)
        await supabase
          .from('whatsapp_messages')
          .update({ status: deliveryStatus })
          .eq('message_id', messageId)
          .in('status', lowerStatuses)
      } else {
        // deliveryStatus === 'sent': set only if no status is recorded yet
        await supabase
          .from('whatsapp_messages')
          .update({ status: deliveryStatus })
          .eq('message_id', messageId)
          .is('status', null)
      }
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
    console.log('[whatsapp-webhook] Event:', body.event, 'instance:', body.instance)

    const { event, instance, data } = body

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
        await handleMessagesUpsert(supabase, session, data, instance)
        break
      case 'messages.update':
        await handleMessagesUpdate(supabase, data)
        break
      case 'send.message':
        await handleMessagesUpsert(supabase, session, data, instance)
        break
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
