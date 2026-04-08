import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const rawEvolutionUrl = Deno.env.get('EVOLUTION_API_URL') || ''
  const EVOLUTION_API_URL = rawEvolutionUrl.startsWith('http') ? rawEvolutionUrl : `https://${rawEvolutionUrl}`
  const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || ''

  const accountId = '98bbd535-b8a4-4a5f-80da-e1e0e35f6809'
  const instanceName = 'senseys_98bbd535_b8a4_4a5f_80da_e1e0e35f6809'
  const results: string[] = []

  // Step 1: Delete instance from Evolution API
  try {
    const deleteResp = await fetch(
      `${EVOLUTION_API_URL}/instance/delete/${instanceName}`,
      { method: 'DELETE', headers: { 'apikey': EVOLUTION_API_KEY } }
    )
    const deleteData = await deleteResp.text()
    results.push(`DELETE instance: ${deleteResp.status} - ${deleteData}`)
  } catch (e) {
    results.push(`DELETE instance error: ${e.message}`)
  }

  // Step 2: Clean whatsapp_sessions
  const { error: sessionError } = await supabase
    .from('whatsapp_sessions')
    .update({
      status: 'disconnected',
      qr_code: null,
      connected_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('account_id', accountId)

  results.push(`Clean session: ${sessionError ? sessionError.message : 'OK'}`)

  // Step 3: Reset failed automations
  const { data: failedAutos, error: autoError } = await supabase
    .from('whatsapp_automation_control')
    .update({
      status: 'active',
      retry_count: 0,
      next_execution_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('account_id', accountId)
    .eq('status', 'failed')
    .gte('created_at', '2025-04-06T00:00:00Z')
    .select('id, lead_id')

  results.push(`Reset automations: ${autoError ? autoError.message : `${failedAutos?.length || 0} records reset`}`)

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
