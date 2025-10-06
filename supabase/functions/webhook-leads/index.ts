import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get account_id from query parameters or body
    const url = new URL(req.url);
    const accountIdFromQuery = url.searchParams.get('account_id');
    
    const body = await req.json();
    const accountId = accountIdFromQuery || body.account_id;

    console.log('Webhook received for account_id:', accountId);

    // Validate account_id
    if (!accountId) {
      return new Response(
        JSON.stringify({ error: 'account_id is required as query parameter or in body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify account exists
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', accountId)
      .single();

    if (accountError || !account) {
      console.error('Account not found:', accountId, accountError);
      return new Response(
        JSON.stringify({ error: 'Invalid account_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!body.name || !body.phone) {
      return new Response(
        JSON.stringify({ error: 'Required fields: name, phone' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get default status for the account
    const { data: defaultStatus } = await supabase
      .from('lead_status')
      .select('id')
      .eq('account_id', accountId)
      .eq('is_default', true)
      .single();

    // Prepare lead data
    const leadData = {
      account_id: accountId,
      name: body.name,
      phone: body.phone,
      email: body.email || null,
      conjunto: body.conjunto || null,
      campanha: body.campanha || null,
      interesse: body.interesse || null,
      observacoes: body.observacoes || null,
      origem: body.origem || 'Webhook',
      anuncio: body.anuncio || null,
      status_id: defaultStatus?.id || null,
    };

    console.log('Inserting lead:', leadData);

    // Insert lead using service role
    const { data: lead, error: insertError } = await supabase
      .from('leads')
      .insert([leadData])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting lead:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create lead', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Lead created successfully:', lead.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        lead_id: lead.id,
        message: 'Lead criado com sucesso' 
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
