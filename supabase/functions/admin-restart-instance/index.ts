import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const rawEvolutionUrl = Deno.env.get('EVOLUTION_API_URL') || ''
    const EVOLUTION_API_URL = rawEvolutionUrl.startsWith('http') ? rawEvolutionUrl : `https://${rawEvolutionUrl}`
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || ''

    const accountId = '98bbd535-b8a4-4a5f-80da-e1e0e35f6809'
    const instanceName = 'senseys_98bbd535_b8a4_4a5f_80da_e1e0e35f6809'

    // Step 1: Restart instance
    const restartResp = await fetch(`${EVOLUTION_API_URL}/instance/restart/${instanceName}`, {
      method: 'PUT',
      headers: { 'apikey': EVOLUTION_API_KEY }
    })
    const restartData = await restartResp.text()
    console.log('Restart:', restartResp.status, restartData)

    // Wait 5s
    await new Promise(r => setTimeout(r, 5000))

    // Step 2: Reconfigure webhook
    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`
    const webhookResp = await fetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhook_by_events: false,
          events: ['CONNECTION_UPDATE', 'QRCODE_UPDATED', 'MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'SEND_MESSAGE']
        }
      })
    })
    const webhookData = await webhookResp.text()
    console.log('Webhook:', webhookResp.status, webhookData)

    // Step 3: Check status
    const statusResp = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
      headers: { 'apikey': EVOLUTION_API_KEY }
    })
    const statusData = await statusResp.json()
    console.log('Status:', JSON.stringify(statusData))

    const isConnected = statusData?.instance?.state === 'open'
    if (isConnected) {
      await supabase.from('whatsapp_sessions')
        .update({ status: 'connected', updated_at: new Date().toISOString() })
        .eq('account_id', accountId)
    }

    // Step 4: Reset failed automations
    const { data: resetRecords, error: resetErr } = await supabase
      .from('whatsapp_automation_control')
      .update({
        status: 'active',
        retry_count: 0,
        next_execution_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('account_id', accountId)
      .eq('status', 'failed')
      .gte('created_at', '2026-04-06T00:00:00Z')
      .select('id, lead_id')

    console.log('Reset automations:', resetRecords?.length, resetErr)

    // Step 5: Test send
    let testResult = null
    if (isConnected) {
      const testResp = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
        body: JSON.stringify({ number: '5511999999999', text: 'test-ping', options: { delay: 0 } })
      })
      testResult = await testResp.text()
      console.log('Test send:', testResp.status, testResult.substring(0, 300))
    }

    return new Response(JSON.stringify({
      restart: restartData,
      webhook: webhookData,
      status: statusData,
      connected: isConnected,
      resetAutomations: resetRecords?.length || 0,
      resetRecords: resetRecords,
      testSend: testResult?.substring(0, 300)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
