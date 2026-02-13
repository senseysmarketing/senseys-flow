import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function extractPhoneFromJid(jid: string): string {
  return jid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@lid', '').replace(/[^0-9]/g, '')
}

function normalizeBrazilianJid(jid: string): string {
  const phone = extractPhoneFromJid(jid)
  if (phone.length === 12 && phone.startsWith('55')) {
    const ddd = phone.slice(2, 4)
    const number = phone.slice(4)
    const suffix = jid.includes('@') ? '@' + jid.split('@')[1] : '@s.whatsapp.net'
    return `55${ddd}9${number}${suffix}`
  }
  return jid
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Authenticate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const userId = claimsData.claims.sub

    // Get account_id
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('account_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!profile?.account_id) {
      return new Response(JSON.stringify({ error: 'Account not found' }), { status: 400, headers: corsHeaders })
    }

    const accountId = profile.account_id
    const { remote_jid } = await req.json()

    if (!remote_jid) {
      return new Response(JSON.stringify({ error: 'remote_jid required' }), { status: 400, headers: corsHeaders })
    }

    // Get WhatsApp session
    const { data: session } = await serviceClient
      .from('whatsapp_sessions')
      .select('instance_name, status')
      .eq('account_id', accountId)
      .eq('status', 'connected')
      .maybeSingle()

    if (!session?.instance_name) {
      return new Response(JSON.stringify({ synced: 0, reason: 'no_session' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || ''
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || ''

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return new Response(JSON.stringify({ synced: 0, reason: 'no_api_config' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiUrl = EVOLUTION_API_URL.startsWith('http') ? EVOLUTION_API_URL : `https://${EVOLUTION_API_URL}`

    // Fetch messages from Evolution API
    console.log(`[whatsapp-sync] Fetching messages for ${remote_jid} from instance ${session.instance_name}`)

    const response = await fetch(
      `${apiUrl}/chat/findMessages/${session.instance_name}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          where: {
            key: {
              remoteJid: remote_jid,
            },
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[whatsapp-sync] Evolution API error: ${response.status} - ${errorText}`)
      return new Response(JSON.stringify({ synced: 0, reason: 'api_error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiMessages = await response.json()
    const messages = Array.isArray(apiMessages) ? apiMessages : apiMessages?.messages || []

    console.log(`[whatsapp-sync] Got ${messages.length} messages from Evolution API`)

    if (messages.length === 0) {
      return new Response(JSON.stringify({ synced: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get existing message_ids from DB
    const messageIds = messages
      .map((m: any) => m.key?.id)
      .filter((id: string | undefined) => !!id)

    const { data: existingMessages } = await serviceClient
      .from('whatsapp_messages')
      .select('message_id')
      .eq('account_id', accountId)
      .in('message_id', messageIds)

    const existingIds = new Set((existingMessages || []).map((m: any) => m.message_id))

    // Insert missing messages
    let synced = 0
    const phone = extractPhoneFromJid(remote_jid)
    const normalizedJid = remote_jid.endsWith('@lid') ? remote_jid : normalizeBrazilianJid(remote_jid)

    for (const msg of messages) {
      const messageId = msg.key?.id
      if (!messageId || existingIds.has(messageId)) continue

      const isFromMe = !!msg.key?.fromMe
      const { content, mediaType, mediaUrl } = extractMessageContent(msg)

      if (!content && mediaType === 'text') continue // Skip empty/protocol messages

      const timestamp = msg.messageTimestamp
        ? new Date(typeof msg.messageTimestamp === 'number' 
            ? (msg.messageTimestamp > 1e12 ? msg.messageTimestamp : msg.messageTimestamp * 1000) 
            : msg.messageTimestamp).toISOString()
        : new Date().toISOString()

      const { error: insertError } = await serviceClient
        .from('whatsapp_messages')
        .insert({
          account_id: accountId,
          remote_jid: normalizedJid,
          phone,
          message_id: messageId,
          content,
          media_type: mediaType,
          media_url: mediaUrl,
          is_from_me: isFromMe,
          status: isFromMe ? 'sent' : 'received',
          timestamp,
          contact_name: msg.pushName || null,
        })

      if (!insertError) {
        synced++
      } else {
        console.error(`[whatsapp-sync] Insert error for ${messageId}:`, insertError.message)
      }
    }

    console.log(`[whatsapp-sync] Synced ${synced} new messages for ${remote_jid}`)

    return new Response(JSON.stringify({ synced }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[whatsapp-sync] Error:', error)
    return new Response(JSON.stringify({ error: error.message, synced: 0 }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
