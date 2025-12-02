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

    // Handle custom fields if provided
    if (body.custom_fields && typeof body.custom_fields === 'object') {
      console.log('Processing custom fields:', body.custom_fields);
      
      // Get custom fields for this account
      const { data: customFields, error: fieldsError } = await supabase
        .from('custom_fields')
        .select('id, field_key')
        .eq('account_id', accountId)
        .eq('is_active', true);

      if (fieldsError) {
        console.error('Error fetching custom fields:', fieldsError);
      } else if (customFields && customFields.length > 0) {
        // Create a map of field_key -> id
        const fieldKeyToId = new Map<string, string>();
        customFields.forEach((field: { id: string; field_key: string }) => {
          fieldKeyToId.set(field.field_key, field.id);
        });

        // Prepare values to insert
        const valuesToInsert: { lead_id: string; custom_field_id: string; value: string }[] = [];
        
        for (const [key, value] of Object.entries(body.custom_fields)) {
          const fieldId = fieldKeyToId.get(key);
          if (fieldId && value !== undefined && value !== null) {
            valuesToInsert.push({
              lead_id: lead.id,
              custom_field_id: fieldId,
              value: String(value)
            });
          } else if (!fieldId) {
            console.log(`Custom field key not found: ${key}`);
          }
        }

        if (valuesToInsert.length > 0) {
          const { error: valuesError } = await supabase
            .from('lead_custom_field_values')
            .insert(valuesToInsert);

          if (valuesError) {
            console.error('Error inserting custom field values:', valuesError);
          } else {
            console.log(`Inserted ${valuesToInsert.length} custom field values`);
          }
        }
      }
    }

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
