// Temporary administrative function: hard-reset stuck WhatsApp instance for Braz Imóveis
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ACCOUNT_ID = '7629c620-65a5-4e89-afbf-599cd221db5d'
const INSTANCE_NAME = 'senseys_7629c620_65a5_4e89_afbf_599cd221db5d'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const rawUrl = Deno.env.get('EVOLUTION_API_URL') || ''
    const apiUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || ''

    const log: any = { instance: INSTANCE_NAME, account_id: ACCOUNT_ID, steps: [] }

    // 1. Try logout (best-effort)
    try {
      const logoutRes = await fetch(`${apiUrl}/instance/logout/${INSTANCE_NAME}`, {
        method: 'DELETE',
        headers: { 'apikey': apiKey },
      })
      log.steps.push({ logout_status: logoutRes.status })
    } catch (e: any) {
      log.steps.push({ logout_error: e.message })
    }

    // 2. Hard delete
    const delRes = await fetch(`${apiUrl}/instance/delete/${INSTANCE_NAME}`, {
      method: 'DELETE',
      headers: { 'apikey': apiKey },
    })
    let delBody: any = null
    try { delBody = await delRes.json() } catch {}
    log.steps.push({ delete_status: delRes.status, delete_body: delBody })

    // 3. Reset DB
    const { error: updErr } = await supabase
      .from('whatsapp_sessions')
      .update({
        status: 'disconnected',
        qr_code: null,
        qr_code_expires_at: null,
        phone_number: null,
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', ACCOUNT_ID)

    log.steps.push({ db_reset_error: updErr?.message ?? null })

    return new Response(JSON.stringify({ success: true, log }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
