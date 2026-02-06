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

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from auth header
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
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'status'
    
    // Build webhook URL for Evolution API callbacks
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`

    console.log(`[whatsapp-connect] Action: ${action}, Account: ${accountId}, Instance: ${instanceName}`)

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
          // Try to get current status from Evolution API
          try {
            const statusResponse = await fetch(
              `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
              {
                method: 'GET',
                headers: {
                  'apikey': EVOLUTION_API_KEY,
                },
              }
            )
            
            if (statusResponse.ok) {
              const statusData = await statusResponse.json()
              console.log('[whatsapp-connect] Existing instance status:', statusData)
              
              if (statusData.instance?.state === 'open') {
                await supabase
                  .from('whatsapp_sessions')
                  .update({ 
                    status: 'connected',
                    updated_at: new Date().toISOString()
                  })
                  .eq('account_id', accountId)
                
                return new Response(JSON.stringify({ 
                  success: true, 
                  status: 'connected',
                  message: 'Instance already connected'
                }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                })
              }
            }
          } catch (e) {
            console.log('[whatsapp-connect] Error checking status:', e)
          }
        }

        // Create or recreate instance with webhook configuration
        const createResponse = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY,
          },
          body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
            webhook: {
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

        const createData = await createResponse.json()
        console.log('[whatsapp-connect] Create response:', createData)

        // Check if instance already exists (handle different error formats)
        const alreadyExists = 
          createData.error?.includes?.('already') || 
          createData.response?.message?.[0]?.includes?.('already in use') ||
          createData.response?.message?.includes?.('already in use')

        if (!createResponse.ok && !alreadyExists) {
          return new Response(JSON.stringify({ error: 'Failed to create instance', details: createData }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // If instance already exists, configure webhook on it
        if (alreadyExists) {
          console.log('[whatsapp-connect] Instance already exists, configuring webhook...')
          
          try {
            const webhookResponse = await fetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY,
              },
              body: JSON.stringify({
                url: webhookUrl,
                webhook_by_events: false,
                events: [
                  'CONNECTION_UPDATE',
                  'QRCODE_UPDATED',
                  'MESSAGES_UPSERT',
                  'MESSAGES_UPDATE'
                ]
              }),
            })
            const webhookData = await webhookResponse.json()
            console.log('[whatsapp-connect] Webhook config response:', webhookData)
          } catch (e) {
            console.log('[whatsapp-connect] Error configuring webhook:', e)
          }
        }

        // Upsert session record
        await supabase
          .from('whatsapp_sessions')
          .upsert({
            account_id: accountId,
            instance_name: instanceName,
            status: 'connecting',
            updated_at: new Date().toISOString()
          }, { onConflict: 'account_id' })

        return new Response(JSON.stringify({ 
          success: true, 
          instanceName,
          status: 'connecting'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'qr-code': {
        console.log('[whatsapp-connect] Getting QR code...')
        
        // Connect to instance to get QR code
        const connectResponse = await fetch(
          `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
          {
            method: 'GET',
            headers: {
              'apikey': EVOLUTION_API_KEY,
            },
          }
        )

        const connectData = await connectResponse.json()
        console.log('[whatsapp-connect] Connect response:', JSON.stringify(connectData).substring(0, 200))

        if (connectData.base64) {
          // Update session with QR code
          await supabase
            .from('whatsapp_sessions')
            .update({ 
              qr_code: connectData.base64,
              qr_code_expires_at: new Date(Date.now() + 60000).toISOString(),
              status: 'qr_ready',
              updated_at: new Date().toISOString()
            })
            .eq('account_id', accountId)

          return new Response(JSON.stringify({ 
            success: true, 
            qrCode: connectData.base64,
            expiresIn: 60
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Check if already connected
        if (connectData.instance?.state === 'open') {
          await supabase
            .from('whatsapp_sessions')
            .update({ 
              status: 'connected',
              connected_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('account_id', accountId)

          return new Response(JSON.stringify({ 
            success: true, 
            status: 'connected',
            message: 'Already connected'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({ 
          success: false, 
          error: 'QR code not available',
          details: connectData
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'status': {
        console.log('[whatsapp-connect] Checking status...')
        
        // Get local session
        const { data: session } = await supabase
          .from('whatsapp_sessions')
          .select('*')
          .eq('account_id', accountId)
          .maybeSingle()

        if (!session) {
          return new Response(JSON.stringify({ 
            status: 'disconnected',
            connected: false
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Check Evolution API status
        try {
          const statusResponse = await fetch(
            `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
            {
              method: 'GET',
              headers: {
                'apikey': EVOLUTION_API_KEY,
              },
            }
          )

          if (statusResponse.ok) {
            const statusData = await statusResponse.json()
            console.log('[whatsapp-connect] Status data:', statusData)

            const isConnected = statusData.instance?.state === 'open'
            const newStatus = isConnected ? 'connected' : session.status

            if (newStatus !== session.status) {
              await supabase
                .from('whatsapp_sessions')
                .update({ 
                  status: newStatus,
                  connected_at: isConnected ? new Date().toISOString() : session.connected_at,
                  updated_at: new Date().toISOString()
                })
                .eq('account_id', accountId)
            }

            return new Response(JSON.stringify({ 
              status: newStatus,
              connected: isConnected,
              phoneNumber: session.phone_number,
              instanceName: session.instance_name
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        } catch (e) {
          console.log('[whatsapp-connect] Error checking status:', e)
        }

        return new Response(JSON.stringify({ 
          status: session.status,
          connected: session.status === 'connected',
          phoneNumber: session.phone_number,
          instanceName: session.instance_name
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'disconnect': {
        console.log('[whatsapp-connect] Disconnecting...')
        
        // Logout from Evolution API
        try {
          await fetch(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
            method: 'DELETE',
            headers: {
              'apikey': EVOLUTION_API_KEY,
            },
          })
        } catch (e) {
          console.log('[whatsapp-connect] Error logging out:', e)
        }

        // Update local status
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
          success: true, 
          status: 'disconnected'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
  } catch (error) {
    console.error('[whatsapp-connect] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
