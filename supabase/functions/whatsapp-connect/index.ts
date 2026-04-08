import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Ensure URL has protocol prefix (fallback for misconfigured secrets)
const rawEvolutionUrl = Deno.env.get('EVOLUTION_API_URL') || ''
const EVOLUTION_API_URL = rawEvolutionUrl.startsWith('http')
  ? rawEvolutionUrl
  : `https://${rawEvolutionUrl}`
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || ''

// Validate URL at startup to catch misconfigured env vars early
if (EVOLUTION_API_URL) {
  try {
    new URL(EVOLUTION_API_URL)
  } catch {
    console.error(`[whatsapp-connect] Invalid EVOLUTION_API_URL: "${EVOLUTION_API_URL}" — check the environment variable`)
  }
}

// Helper function to fetch phone number from Evolution API
async function fetchPhoneNumber(instanceName: string): Promise<string | null> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) return null
  
  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${instanceName}`,
      { headers: { 'apikey': EVOLUTION_API_KEY } }
    )
    const data = await response.json()
    
    console.log('[whatsapp-connect] fetchInstances response:', JSON.stringify(data).substring(0, 500))
    
    const ownerJid = data[0]?.ownerJid
    
    console.log('[whatsapp-connect] Extracted ownerJid:', ownerJid)
    
    if (ownerJid) {
      const phoneRaw = ownerJid.split('@')[0]
      if (phoneRaw.length >= 12) {
        const countryCode = phoneRaw.slice(0, 2)
        const areaCode = phoneRaw.slice(2, 4)
        const firstPart = phoneRaw.slice(4, 9)
        const secondPart = phoneRaw.slice(9)
        return `+${countryCode} (${areaCode}) ${firstPart}-${secondPart}`
      }
      return `+${phoneRaw}`
    }
  } catch (e) {
    console.log('[whatsapp-connect] Error fetching phone:', e)
  }
  return null
}

// Helper to configure webhook for an instance
async function configureWebhook(instanceName: string, webhookUrl: string) {
  const webhookResponse = await fetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY,
    },
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhook_by_events: false,
        events: [
          'CONNECTION_UPDATE',
          'QRCODE_UPDATED',
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'SEND_MESSAGE'
        ]
      }
    }),
  })
  const webhookData = await webhookResponse.json()
  return webhookData
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
    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`

    // Parse action and require JWT for all actions
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'status'

    // === ALL ACTIONS: require JWT ===
    const authHeader = req.headers.get('Authorization')
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

    const accountId = profile.account_id
    const instanceName = `senseys_${accountId.replace(/-/g, '_')}`

    console.log(`[whatsapp-connect] Action: ${action}, Account: ${accountId}, Instance: ${instanceName}`)

    // === AUTHENTICATED ACTION: force-reconfigure ===
    if (action === 'force-reconfigure') {
      // Use authenticated user's account_id — ignore any account_id query param for security
      const targetAccountId = accountId
      const targetInstance = instanceName
      console.log(`[whatsapp-connect] Force reconfigure for instance: ${targetInstance}`)

      // Check if instance is connected
      try {
        const statusResp = await fetch(
          `${EVOLUTION_API_URL}/instance/connectionState/${targetInstance}`,
          { headers: { 'apikey': EVOLUTION_API_KEY } }
        )

        if (statusResp.ok) {
          const statusData = await statusResp.json()
          console.log('[whatsapp-connect] Instance state:', statusData)

          if (statusData.instance?.state === 'open') {
            const webhookData = await configureWebhook(targetInstance, webhookUrl)
            console.log('[whatsapp-connect] Force reconfigure result:', JSON.stringify(webhookData).substring(0, 300))

            // Verify
            const verifyResponse = await fetch(
              `${EVOLUTION_API_URL}/webhook/find/${targetInstance}`,
              { headers: { 'apikey': EVOLUTION_API_KEY } }
            )
            const currentConfig = await verifyResponse.json()
            console.log('[whatsapp-connect] Webhook verified after force-reconfigure:', JSON.stringify(currentConfig).substring(0, 500))

            return new Response(JSON.stringify({
              success: true,
              message: 'Webhook reconfigured successfully',
              webhookConfig: currentConfig
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          } else {
            return new Response(JSON.stringify({
              error: 'Instance not connected',
              state: statusData.instance?.state
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        }
      } catch (e) {
        console.log('[whatsapp-connect] Error in force-reconfigure:', e)
        return new Response(JSON.stringify({ error: 'Failed to reconfigure', details: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // === AUTHENTICATED ACTION: restart-instance ===
    if (action === 'restart-instance') {
      // Use authenticated user's account_id — ignore any account_id query param for security
      const targetInstance = instanceName
      console.log(`[whatsapp-connect] Restarting instance: ${targetInstance}`)

      try {
        const restartResp = await fetch(
          `${EVOLUTION_API_URL}/instance/restart/${targetInstance}`,
          { method: 'PUT', headers: { 'apikey': EVOLUTION_API_KEY } }
        )
        const restartData = await restartResp.json()
        console.log('[whatsapp-connect] Restart result:', JSON.stringify(restartData))

        // Wait for reconnection
        await new Promise(resolve => setTimeout(resolve, 3000))

        // Reconfigure webhook
        const webhookData = await configureWebhook(targetInstance, webhookUrl)
        console.log('[whatsapp-connect] Webhook reconfigured after restart:', JSON.stringify(webhookData).substring(0, 300))

        return new Response(JSON.stringify({
          success: true, message: 'Instance restarted and webhook reconfigured',
          restart: restartData, webhook: webhookData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (e) {
        console.log('[whatsapp-connect] Error restarting instance:', e)
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    switch (action) {
      case 'create-instance': {
        console.log('[whatsapp-connect] Creating instance...')
        
        // Check if instance already exists
        const { data: existingSession } = await supabase
          .from('whatsapp_sessions')
          .select('*')
          .eq('account_id', accountId)
          .maybeSingle()

        if (existingSession) {
          try {
            const statusResponse = await fetch(
              `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
              { method: 'GET', headers: { 'apikey': EVOLUTION_API_KEY } }
            )
            
            if (statusResponse.ok) {
              const statusData = await statusResponse.json()
              console.log('[whatsapp-connect] Existing instance status:', statusData)
              
              if (statusData.instance?.state === 'open') {
                await supabase
                  .from('whatsapp_sessions')
                  .update({ status: 'connected', updated_at: new Date().toISOString() })
                  .eq('account_id', accountId)
                
                return new Response(JSON.stringify({ 
                  success: true, status: 'connected', message: 'Instance already connected'
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
              }
            }
          } catch (e) {
            console.log('[whatsapp-connect] Error checking status:', e)
          }
        }

        // Create or recreate instance with webhook configuration
        const createResponse = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
          body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
            webhook: {
              enabled: true,
              url: webhookUrl,
              webhook_by_events: false,
              events: ['CONNECTION_UPDATE', 'QRCODE_UPDATED', 'MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'SEND_MESSAGE']
            }
          }),
        })

        const createData = await createResponse.json()
        console.log('[whatsapp-connect] Create response:', createData)

        const alreadyExists = 
          createData.error?.includes?.('already') || 
          createData.response?.message?.[0]?.includes?.('already in use') ||
          createData.response?.message?.includes?.('already in use')

        if (!createResponse.ok && !alreadyExists) {
          return new Response(JSON.stringify({ error: 'Failed to create instance', details: createData }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        if (alreadyExists) {
          console.log('[whatsapp-connect] Instance already exists, configuring webhook...')
          try {
            const webhookData = await configureWebhook(instanceName, webhookUrl)
            console.log('[whatsapp-connect] Webhook config response:', webhookData)
          } catch (e) {
            console.log('[whatsapp-connect] Error configuring webhook:', e)
          }
        }

        // Upsert session record
        await supabase
          .from('whatsapp_sessions')
          .upsert({
            account_id: accountId, instance_name: instanceName,
            status: 'connecting', updated_at: new Date().toISOString()
          }, { onConflict: 'account_id' })

        return new Response(JSON.stringify({ success: true, instanceName, status: 'connecting' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'qr-code': {
        console.log('[whatsapp-connect] Getting QR code...')
        
        const connectResponse = await fetch(
          `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
          { method: 'GET', headers: { 'apikey': EVOLUTION_API_KEY } }
        )

        const connectData = await connectResponse.json()
        console.log('[whatsapp-connect] Connect response:', JSON.stringify(connectData).substring(0, 200))

        if (connectData.base64) {
          await supabase
            .from('whatsapp_sessions')
            .update({ 
              qr_code: connectData.base64,
              qr_code_expires_at: new Date(Date.now() + 60000).toISOString(),
              status: 'qr_ready',
              updated_at: new Date().toISOString()
            })
            .eq('account_id', accountId)

          return new Response(JSON.stringify({ success: true, qrCode: connectData.base64, expiresIn: 60 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        if (connectData.instance?.state === 'open') {
          const phoneNumber = await fetchPhoneNumber(instanceName)
          
          await supabase
            .from('whatsapp_sessions')
            .update({ 
              status: 'connected', phone_number: phoneNumber,
              connected_at: new Date().toISOString(), updated_at: new Date().toISOString()
            })
            .eq('account_id', accountId)

          return new Response(JSON.stringify({ 
            success: true, status: 'connected', phoneNumber, message: 'Already connected'
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        return new Response(JSON.stringify({ success: false, error: 'QR code not available', details: connectData }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'status': {
        console.log('[whatsapp-connect] Checking status...')
        
        const { data: session } = await supabase
          .from('whatsapp_sessions')
          .select('*')
          .eq('account_id', accountId)
          .maybeSingle()

        if (!session) {
          return new Response(JSON.stringify({ status: 'disconnected', connected: false }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        try {
          const statusResponse = await fetch(
            `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
            { method: 'GET', headers: { 'apikey': EVOLUTION_API_KEY } }
          )

          if (statusResponse.ok) {
            const statusData = await statusResponse.json()
            console.log('[whatsapp-connect] Status data:', statusData)

            const evolutionState = statusData.instance?.state
            const isConnected = evolutionState === 'open'

            // Auto-recovery: if Evolution says "connecting" and DB has been stuck for 5+ min, delete & recreate
            if (evolutionState === 'connecting') {
              const updatedAt = session.updated_at ? new Date(session.updated_at).getTime() : 0
              const stuckMinutes = (Date.now() - updatedAt) / 60000
              const isStuckState = ['connecting', 'qr_ready'].includes(session.status || '')

              if (isStuckState && stuckMinutes > 5) {
                console.log(`[whatsapp-connect] Instance stuck in "connecting" for ${stuckMinutes.toFixed(1)} min — auto-recovering...`)

                // Delete the corrupted instance
                try {
                  const delResp = await fetch(
                    `${EVOLUTION_API_URL}/instance/delete/${instanceName}`,
                    { method: 'DELETE', headers: { 'apikey': EVOLUTION_API_KEY } }
                  )
                  console.log('[whatsapp-connect] Auto-delete result:', delResp.status)
                } catch (e) {
                  console.log('[whatsapp-connect] Auto-delete error:', e)
                }

                // Reset DB session so user can reconnect cleanly
                await supabase
                  .from('whatsapp_sessions')
                  .update({
                    status: 'disconnected',
                    qr_code: null,
                    connected_at: null,
                    updated_at: new Date().toISOString()
                  })
                  .eq('account_id', accountId)

                return new Response(JSON.stringify({
                  status: 'disconnected', connected: false,
                  autoRecovered: true,
                  message: 'Instância travada foi recuperada automaticamente. Reconecte o WhatsApp.'
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
              }
            }

            const newStatus = isConnected ? 'connected' : 'disconnected'

            // Reconfigure webhook automatically when connected
            if (isConnected) {
              try {
                const webhookSetData = await configureWebhook(instanceName, webhookUrl)
                console.log('[whatsapp-connect] Webhook reconfigured for', instanceName, ':', JSON.stringify(webhookSetData).substring(0, 300))
                
                const verifyResponse = await fetch(
                  `${EVOLUTION_API_URL}/webhook/find/${instanceName}`,
                  { headers: { 'apikey': EVOLUTION_API_KEY } }
                )
                const currentConfig = await verifyResponse.json()
                console.log('[whatsapp-connect] Webhook verified:', JSON.stringify(currentConfig).substring(0, 500))
              } catch (e) {
                console.log('[whatsapp-connect] Error reconfiguring webhook:', e)
              }
            }

            let phoneNumber = session.phone_number
            if (isConnected) {
              const freshPhone = await fetchPhoneNumber(instanceName)
              console.log('[whatsapp-connect] Fetched phone number:', freshPhone)
              if (freshPhone) phoneNumber = freshPhone
            }

            const phoneChanged = isConnected && phoneNumber && phoneNumber !== session.phone_number
            if (newStatus !== session.status || phoneChanged) {
              console.log('[whatsapp-connect] Status changed:', session.status, '->', newStatus)
              await supabase
                .from('whatsapp_sessions')
                .update({ 
                  status: newStatus,
                  phone_number: isConnected ? (phoneNumber || session.phone_number) : session.phone_number,
                  connected_at: isConnected ? (session.connected_at || new Date().toISOString()) : null,
                  updated_at: new Date().toISOString()
                })
                .eq('account_id', accountId)
            }

            return new Response(JSON.stringify({ 
              status: newStatus, connected: isConnected,
              phoneNumber, instanceName: session.instance_name
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
          }
        } catch (e) {
          console.log('[whatsapp-connect] Error checking status:', e)
        }

        return new Response(JSON.stringify({ 
          status: session.status, connected: session.status === 'connected',
          phoneNumber: session.phone_number, instanceName: session.instance_name
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'disconnect': {
        console.log('[whatsapp-connect] Disconnecting...')
        
        try {
          await fetch(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
            method: 'DELETE', headers: { 'apikey': EVOLUTION_API_KEY },
          })
        } catch (e) {
          console.log('[whatsapp-connect] Error logging out:', e)
        }

        await supabase
          .from('whatsapp_sessions')
          .update({ status: 'disconnected', qr_code: null, connected_at: null, updated_at: new Date().toISOString() })
          .eq('account_id', accountId)

        return new Response(JSON.stringify({ success: true, status: 'disconnected' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'check-webhook': {
        console.log('[whatsapp-connect] Checking webhook config...')
        
        try {
          const findResponse = await fetch(
            `${EVOLUTION_API_URL}/webhook/find/${instanceName}`,
            { headers: { 'apikey': EVOLUTION_API_KEY } }
          )
          const webhookConfig = await findResponse.json()
          console.log('[whatsapp-connect] Current webhook config:', JSON.stringify(webhookConfig))
          
          return new Response(JSON.stringify({ success: true, webhookConfig }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (e) {
          console.log('[whatsapp-connect] Error checking webhook:', e)
          return new Response(JSON.stringify({ error: 'Failed to check webhook', details: e.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      case 'reconfigure-webhook': {
        console.log('[whatsapp-connect] Reconfiguring webhook...')
        
        try {
          const webhookData = await configureWebhook(instanceName, webhookUrl)
          console.log('[whatsapp-connect] Webhook reconfigure result:', JSON.stringify(webhookData))
          
          return new Response(JSON.stringify({ success: true, webhook: webhookData }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (e) {
          console.log('[whatsapp-connect] Error reconfiguring webhook:', e)
          return new Response(JSON.stringify({ error: 'Failed to reconfigure webhook', details: e.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
  } catch (error) {
    console.error('[whatsapp-connect] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
