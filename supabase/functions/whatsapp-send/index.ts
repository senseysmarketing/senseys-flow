import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-call',
}

// Ensure EVOLUTION_API_URL has proper protocol
const rawEvolutionUrl = Deno.env.get('EVOLUTION_API_URL') || ''
const EVOLUTION_API_URL = rawEvolutionUrl.startsWith('http') ? rawEvolutionUrl : `https://${rawEvolutionUrl}`
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || ''

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

    const { data: session, error: sessionError } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('account_id', accountId)
      .eq('status', 'connected')
      .maybeSingle()

    if (sessionError || !session) {
      console.log('[whatsapp-send] No connected session found')
      return new Response(JSON.stringify({ 
        error: 'WhatsApp not connected',
        connected: false
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Send message via Evolution API
    const sendResponse = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${session.instance_name}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: formattedPhone,
          text: message,
        }),
      }
    )

    const sendData = await sendResponse.json()
    console.log('[whatsapp-send] Send response:', JSON.stringify(sendData))

    // Detect invalid number: Evolution API returns exists: false or specific error patterns
    const isInvalidNumber = 
      sendData?.exists === false || 
      sendData?.error?.includes?.('not exist') ||
      sendData?.error?.includes?.('not registered') ||
      sendData?.message?.includes?.('not exist') ||
      (sendData?.status === 404) ||
      (typeof sendData === 'object' && sendData !== null && 'exists' in sendData && sendData.exists === false)

    if (!sendResponse.ok || isInvalidNumber) {
      const errorMsg = isInvalidNumber 
        ? 'Número não possui WhatsApp' 
        : (sendData?.error || sendData?.message || 'Failed to send message')

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

    // Log successful message
    await supabase.from('whatsapp_message_log').insert({
      account_id: accountId,
      lead_id,
      template_id,
      message_content: message,
      sent_by: userId,
      send_type: isInternalCall ? 'automation' : 'api',
      message_id: sendData.key?.id,
      delivery_status: 'sent',
    })

    // Store in whatsapp_messages for conversation view
    const remoteJid = `${formattedPhone}@s.whatsapp.net`
    await supabase.from('whatsapp_messages').insert({
      account_id: accountId,
      remote_jid: remoteJid,
      phone: formattedPhone,
      message_id: sendData.key?.id,
      content: message,
      media_type: 'text',
      is_from_me: true,
      status: 'sent',
      timestamp: new Date().toISOString(),
      lead_id: lead_id || null,
    })

    // Update conversation
    const { data: existingConv } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('account_id', accountId)
      .eq('remote_jid', remoteJid)
      .maybeSingle()

    if (existingConv) {
      await supabase.from('whatsapp_conversations').update({
        last_message: message.substring(0, 500),
        last_message_at: new Date().toISOString(),
        last_message_is_from_me: true,
        updated_at: new Date().toISOString(),
        lead_id: lead_id || undefined,
      }).eq('id', existingConv.id)
    } else {
      await supabase.from('whatsapp_conversations').insert({
        account_id: accountId,
        remote_jid: remoteJid,
        phone: formattedPhone,
        last_message: message.substring(0, 500),
        last_message_at: new Date().toISOString(),
        last_message_is_from_me: true,
        lead_id: lead_id || null,
      })
    }

    // Layer 3: Capture @lid from Evolution API response for future mapping
    try {
      const responseRemoteJid = sendData.key?.remoteJid
      if (responseRemoteJid && responseRemoteJid.includes('@lid')) {
        console.log(`[whatsapp-send] 📌 Captured @lid mapping: ${formattedPhone} -> ${responseRemoteJid}`)
        
        // Save the lid_jid in the conversation for this lead
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
      messageId: sendData.key?.id
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
