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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if this is an internal call from another edge function
    const isInternalCall = req.headers.get('x-internal-call') === 'true'
    const authHeader = req.headers.get('Authorization')

    let accountId: string
    let userId: string | null = null
    
    // Parse body first (we need it for both paths)
    const body = await req.json()
    const { phone, message, lead_id, template_id, account_id: bodyAccountId } = body

    if (isInternalCall) {
      // Internal call from process-whatsapp-queue - account_id comes from body
      console.log('[whatsapp-send] Internal call detected')
      
      if (!bodyAccountId) {
        return new Response(JSON.stringify({ error: 'account_id is required for internal calls' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      accountId = bodyAccountId
    } else {
      // External call from frontend - validate user token
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

      // Get user's account_id
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

    // Format phone number for Evolution API
    const formattedPhone = formatPhoneForEvolution(phone)
    console.log(`[whatsapp-send] Sending message to ${phone} -> formatted: ${formattedPhone} for account ${accountId}`)

    // Get session for this account
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
    console.log('[whatsapp-send] Send response:', sendData)

    if (!sendResponse.ok) {
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
        error: 'Failed to send message',
        details: sendData
      }), {
        status: 500,
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
