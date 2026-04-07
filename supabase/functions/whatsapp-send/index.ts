import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-call',
}

// Ensure EVOLUTION_API_URL has proper protocol
const rawEvolutionUrl = Deno.env.get('EVOLUTION_API_URL') || ''
const EVOLUTION_API_URL = rawEvolutionUrl.startsWith('http') ? rawEvolutionUrl : `https://${rawEvolutionUrl}`
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || ''

// Validate URL at startup to catch misconfigured env vars early
if (EVOLUTION_API_URL) {
  try {
    new URL(EVOLUTION_API_URL)
  } catch {
    console.error(`[whatsapp-send] Invalid EVOLUTION_API_URL: "${EVOLUTION_API_URL}" — check the environment variable`)
  }
}

// Robust phone formatting for Evolution API
function formatPhoneForEvolution(phone: string): string {
  let cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    return cleaned
  }
  if (cleaned.length >= 10 && cleaned.length <= 11) {
    return '55' + cleaned
  }
  return cleaned
}

// Sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Detect invalid number from Evolution API response.
// The API returns exists:false in a nested structure:
//   {"status":400,"error":"Bad Request","response":{"message":[{"exists":false,...}]}}
// This helper checks both the root level and the nested structure.
function detectInvalidNumber(data: any): boolean {
  if (!data || typeof data !== 'object') return false
  // Root-level exists flag
  if (data.exists === false) return true
  // Nested response.message[].exists (most common pattern)
  if (Array.isArray(data?.response?.message)) {
    if (data.response.message.some((m: any) => m.exists === false)) return true
  }
  // Error message patterns
  const errorStr = (data?.error || data?.message || '').toString().toLowerCase()
  if (errorStr.includes('not exist') || errorStr.includes('not registered')) return true
  // HTTP 404 from Evolution means the number doesn't exist
  if (data?.status === 404) return true
  return false
}

// Normalize Evolution API errors to user-friendly Portuguese messages
function normalizeEvolutionError(status: number, data: any): string {
  // Check invalid number first (handles nested structure)
  if (detectInvalidNumber(data)) return 'Número não possui WhatsApp'

  const errorMsg = data?.error || data?.message || ''
  const errorStr = typeof errorMsg === 'string' ? errorMsg.toLowerCase() : ''

  if (status === 401 || errorStr.includes('unauthorized') || errorStr.includes('invalid api')) {
    return 'Erro de autenticação com a API. Verifique as configurações.'
  }
  if (status === 404 || errorStr.includes('not found') || errorStr.includes('instance not found')) {
    return 'Sessão do WhatsApp não encontrada. Reconecte nas configurações.'
  }
  if (status === 408 || errorStr.includes('timeout') || errorStr.includes('timed out')) {
    return 'Servidor não respondeu a tempo. Tente novamente.'
  }
  if (status === 400) {
    // Check for "not-acceptable" which indicates a degraded instance needing restart
    if (errorStr.includes('not-acceptable') || (Array.isArray(data?.response?.message) && data.response.message.some((m: any) => typeof m === 'string' && m.toLowerCase().includes('not-acceptable')))) {
      return 'Instância do WhatsApp em estado degradado. Reiniciando automaticamente...'
    }
    return 'Erro temporário na conexão. Tente novamente em alguns segundos.'
  }
  if (status >= 500) {
    return 'Erro no servidor do WhatsApp. Tente novamente em alguns segundos.'
  }
  return errorMsg || 'Erro ao enviar mensagem. Tente novamente.'
}

// Send message to Evolution API with 1 automatic retry on 400/500 errors
async function sendWithRetry(
  instanceName: string,
  formattedPhone: string,
  message: string,
  maxRetries = 1
): Promise<{ response: Response; data: any }> {
  const url = `${EVOLUTION_API_URL}/message/sendText/${instanceName}`
  const body = JSON.stringify({ number: formattedPhone, text: message })
  const headers = { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const isRetry = attempt > 0
    if (isRetry) {
      console.log(`[whatsapp-send] ⏳ Retry attempt ${attempt} after 3s backoff...`)
      await sleep(3000)
    }

    const response = await fetch(url, { method: 'POST', headers, body })
    const data = await response.json()

    console.log(`[whatsapp-send] ${isRetry ? 'RETRY' : 'Attempt'} ${attempt + 1} - Status: ${response.status}, Body: ${JSON.stringify(data).substring(0, 300)}`)

    // If success, return immediately
    if (response.ok) {
      return { response, data }
    }

    // Check if it's an invalid number error - no point retrying
    if (detectInvalidNumber(data)) {
      return { response, data }
    }

    // Only retry on 400 or 5xx errors (likely transient)
    const shouldRetry = (response.status === 400 || response.status >= 500) && attempt < maxRetries
    if (!shouldRetry) {
      return { response, data }
    }
  }

  // Fallback (shouldn't reach here)
  throw new Error('sendWithRetry exhausted all attempts')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const isInternalCall = req.headers.get('x-internal-call') === 'true'
    const authHeader = req.headers.get('Authorization')

    let accountId: string
    let userId: string | null = null
    
    const body = await req.json()
    const { phone, message, lead_id, template_id, account_id: bodyAccountId } = body

    if (isInternalCall) {
      console.log('[whatsapp-send] Internal call detected')
      if (!bodyAccountId) {
        return new Response(JSON.stringify({ error: 'account_id is required for internal calls' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      accountId = bodyAccountId
    } else {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      userId = user.id

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('account_id')
        .eq('user_id', user.id)
        .single()

      if (profileError || !profile) {
        return new Response(JSON.stringify({ error: 'Profile not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      accountId = profile.account_id
    }

    if (!phone || !message) {
      return new Response(JSON.stringify({ error: 'Phone and message are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const formattedPhone = formatPhoneForEvolution(phone)
    console.log(`[whatsapp-send] Sending message to ${phone} -> formatted: ${formattedPhone} for account ${accountId}`)

    // Fetch session regardless of status
    const { data: session, error: sessionError } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle()

    if (sessionError || !session) {
      console.log('[whatsapp-send] No session found at all')
      return new Response(JSON.stringify({ 
        error: 'Sessão do WhatsApp não encontrada. Configure nas configurações.',
        connected: false
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // If DB says not connected, verify directly with Evolution API before giving up
    if (session.status !== 'connected') {
      console.log(`[whatsapp-send] DB status is '${session.status}', verifying with Evolution API...`)
      let apiConfirmsConnected = false
      try {
        const statusResp = await fetch(
          `${EVOLUTION_API_URL}/instance/connectionState/${session.instance_name}`,
          { headers: { 'apikey': EVOLUTION_API_KEY } }
        )
        if (statusResp.ok) {
          const statusData = await statusResp.json()
          if (statusData.instance?.state === 'open') {
            apiConfirmsConnected = true
            await supabase.from('whatsapp_sessions')
              .update({ status: 'connected', updated_at: new Date().toISOString() })
              .eq('account_id', accountId)
            console.log(`[whatsapp-send] ✅ Session was stale - Evolution API confirms CONNECTED. Updated DB.`)
          }
        }
      } catch (apiErr) {
        console.error('[whatsapp-send] Error checking Evolution API status:', apiErr)
      }

      if (!apiConfirmsConnected) {
        console.log('[whatsapp-send] Session truly disconnected')
        return new Response(JSON.stringify({ 
          error: 'WhatsApp não conectado. Reconecte nas configurações.',
          connected: false
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Send message via Evolution API with automatic retry
    const { response: sendResponse, data: sendData } = await sendWithRetry(
      session.instance_name,
      formattedPhone,
      message
    )

    // Detect invalid number using the shared helper (checks root + nested response.message[].exists)
    const isInvalidNumber = detectInvalidNumber(sendData)

    if (!sendResponse.ok || isInvalidNumber) {
      const errorMsg = isInvalidNumber 
        ? 'Número não possui WhatsApp' 
        : normalizeEvolutionError(sendResponse.status, sendData)

      // Log failed message
      await supabase.from('whatsapp_message_log').insert({
        account_id: accountId,
        lead_id,
        template_id,
        message_content: message,
        sent_by: userId,
        send_type: isInternalCall ? 'automation' : 'api',
        delivery_status: 'failed',
      })

      return new Response(JSON.stringify({ 
        error: errorMsg,
        invalid_number: isInvalidNumber,
        details: sendData
      }), {
        status: isInvalidNumber ? 422 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Guard: ensure message_id is never NULL to prevent silent duplicate inserts
    const safeMessageId = sendData.key?.id ?? `${session.instance_name}-${Date.now()}-${crypto.randomUUID().slice(0,8)}`

    // Log successful message
    await supabase.from('whatsapp_message_log').insert({
      account_id: accountId,
      lead_id,
      template_id,
      message_content: message,
      sent_by: userId,
      send_type: isInternalCall ? 'automation' : 'api',
      message_id: safeMessageId,
      delivery_status: 'sent',
    })

    // Store in whatsapp_messages for conversation view (idempotent)
    const remoteJid = `${formattedPhone}@s.whatsapp.net`
    await supabase.from('whatsapp_messages').upsert({
      account_id: accountId,
      remote_jid: remoteJid,
      phone: formattedPhone,
      message_id: safeMessageId,
      content: message,
      media_type: 'text',
      is_from_me: true,
      status: 'sent',
      timestamp: new Date().toISOString(),
      lead_id: lead_id || null,
      session_phone: session.phone_number || null,
    }, { onConflict: 'account_id,message_id', ignoreDuplicates: true })

    // Update conversation
    const { data: existingConv } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('account_id', accountId)
      .eq('remote_jid', remoteJid)
      .maybeSingle()

    const now = new Date().toISOString()
    if (existingConv) {
      await supabase.from('whatsapp_conversations').update({
        last_message: message.substring(0, 500),
        last_message_at: now,
        last_message_is_from_me: true,
        updated_at: now,
        lead_id: lead_id || undefined,
        session_phone: session.phone_number || null,
      }).eq('id', existingConv.id)
    } else {
      await supabase.from('whatsapp_conversations').insert({
        account_id: accountId,
        remote_jid: remoteJid,
        phone: formattedPhone,
        last_message: message.substring(0, 500),
        last_message_at: now,
        last_message_is_from_me: true,
        lead_id: lead_id || null,
        session_phone: session.phone_number || null,
      })
    }

    // Layer 3: Capture @lid from Evolution API response for future mapping
    try {
      const responseRemoteJid = sendData.key?.remoteJid
      if (responseRemoteJid && responseRemoteJid.includes('@lid')) {
        console.log(`[whatsapp-send] 📌 Captured @lid mapping: ${formattedPhone} -> ${responseRemoteJid}`)
        
        const phoneRemoteJid = `${formattedPhone}@s.whatsapp.net`
        await supabase
          .from('whatsapp_conversations')
          .update({ lid_jid: responseRemoteJid })
          .eq('account_id', accountId)
          .eq('remote_jid', phoneRemoteJid)
      }
    } catch (lidErr) {
      console.error('[whatsapp-send] Error capturing @lid:', lidErr)
    }

    console.log('[whatsapp-send] Message sent successfully')
    return new Response(JSON.stringify({ 
      success: true,
      messageId: safeMessageId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[whatsapp-send] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
