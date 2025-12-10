import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFY_TOKEN = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN') || '';
const META_APP_SECRET = Deno.env.get('META_APP_SECRET') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

// Verify Meta webhook signature
async function verifySignature(payload: string, signature: string): Promise<boolean> {
  if (!signature || !META_APP_SECRET) return false;
  
  const expectedSignature = signature.replace('sha256=', '');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(META_APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return computedSignature === expectedSignature;
}

serve(async (req) => {
  const url = new URL(req.url);
  const timestamp = new Date().toISOString();

  // Log ALL incoming requests for debugging
  console.log('='.repeat(60));
  console.log(`[${timestamp}] INCOMING REQUEST`);
  console.log(`Method: ${req.method}`);
  console.log(`URL: ${req.url}`);
  console.log(`Headers: ${JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2)}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  // Diagnostic test endpoint
  if (url.searchParams.get('test') === 'true') {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Check token
    const { data: tokenData } = await supabase
      .from('meta_agency_token')
      .select('id, user_name, created_at')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single();

    // Check configured accounts
    const { data: configs } = await supabase
      .from('account_meta_config')
      .select('account_id, page_id, ad_account_id, is_active');

    const diagnostics = {
      status: 'Webhook is active',
      timestamp,
      environment: {
        verify_token_configured: !!VERIFY_TOKEN,
        app_secret_configured: !!META_APP_SECRET,
        supabase_url: SUPABASE_URL ? 'configured' : 'missing',
      },
      meta_token: tokenData ? {
        exists: true,
        user_name: tokenData.user_name,
        created_at: tokenData.created_at,
      } : { exists: false },
      configured_accounts: configs || [],
      instructions: {
        webhook_url: `${SUPABASE_URL}/functions/v1/meta-webhook`,
        verify_token: 'Use the value configured in META_WEBHOOK_VERIFY_TOKEN secret',
        required_subscription: 'leadgen',
      }
    };

    console.log('Diagnostic request - returning status');
    return new Response(JSON.stringify(diagnostics, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Meta Webhook Verification (GET request)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('Webhook verification request:', { mode, token: token ? `${token.substring(0, 10)}...` : 'none', challenge });
    console.log(`Expected token starts with: ${VERIFY_TOKEN ? VERIFY_TOKEN.substring(0, 10) + '...' : 'NOT CONFIGURED'}`);

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verified successfully');
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }

    console.log('❌ Webhook verification failed - token mismatch or missing mode');
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  // Handle incoming webhook events (POST request)
  if (req.method === 'POST') {
    try {
      const body = await req.text();
      console.log(`Body length: ${body.length} characters`);
      console.log(`Body preview: ${body.substring(0, 500)}...`);

      const signature = req.headers.get('x-hub-signature-256');
      console.log(`Signature present: ${!!signature}`);

      // Verify signature in production (but don't block if not configured)
      if (signature && META_APP_SECRET) {
        const isValid = await verifySignature(body, signature);
        if (!isValid) {
          console.error('❌ Invalid webhook signature');
          return new Response('Invalid signature', { status: 401, headers: corsHeaders });
        }
        console.log('✅ Signature verified');
      } else {
        console.log('⚠️ Skipping signature verification (not configured or missing)');
      }

      const data = JSON.parse(body);
      console.log('Parsed webhook data:', JSON.stringify(data, null, 2));

      // Check if this is a leadgen event
      if (data.object !== 'page') {
        console.log(`Not a page event (object: ${data.object}), ignoring`);
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Get the Meta token for API calls
      const { data: tokenData, error: tokenError } = await supabase
        .from('meta_agency_token')
        .select('access_token')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .single();

      if (tokenError || !tokenData?.access_token) {
        console.error('❌ No Meta token found:', tokenError);
        return new Response('OK', { status: 200, headers: corsHeaders });
      }
      console.log('✅ Meta token found');

      // Process each entry
      for (const entry of data.entry || []) {
        const pageId = entry.id;
        console.log(`Processing entry for page_id: ${pageId}`);

        // Find which account this page belongs to
        const { data: metaConfig, error: configError } = await supabase
          .from('account_meta_config')
          .select('account_id, ad_account_id')
          .eq('page_id', pageId)
          .eq('is_active', true)
          .single();

        if (configError || !metaConfig) {
          console.log(`❌ No active config found for page ${pageId}. Error:`, configError);
          
          // Log all configured pages for debugging
          const { data: allConfigs } = await supabase
            .from('account_meta_config')
            .select('page_id, account_id, is_active');
          console.log('All configured pages:', JSON.stringify(allConfigs, null, 2));
          continue;
        }

        console.log(`✅ Found config for page ${pageId} -> account ${metaConfig.account_id}`);

        // Process leadgen changes
        for (const change of entry.changes || []) {
          console.log(`Processing change: field=${change.field}`);
          
          if (change.field !== 'leadgen') {
            console.log(`Skipping non-leadgen field: ${change.field}`);
            continue;
          }

          const leadgenId = change.value.leadgen_id;
          const formId = change.value.form_id;
          const adId = change.value.ad_id;
          const adgroupId = change.value.adgroup_id;

          console.log(`Processing lead: leadgen_id=${leadgenId}, form_id=${formId}, ad_id=${adId}`);

          // Fetch lead details from Meta API
          const leadResponse = await fetch(
            `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${tokenData.access_token}`
          );
          const leadData = await leadResponse.json();

          if (leadData.error) {
            console.error('❌ Error fetching lead data from Meta:', leadData.error);
            continue;
          }

          console.log('✅ Lead data from Meta:', JSON.stringify(leadData, null, 2));

          // Parse lead fields
          const fieldData: Record<string, string> = {};
          for (const field of leadData.field_data || []) {
            fieldData[field.name.toLowerCase()] = field.values?.[0] || '';
          }
          console.log('Parsed field data:', JSON.stringify(fieldData, null, 2));

          // Extract common fields
          const name = fieldData['full_name'] || fieldData['nome'] || fieldData['name'] || 'Lead do Facebook';
          const phone = fieldData['phone_number'] || fieldData['telefone'] || fieldData['phone'] || '';
          const email = fieldData['email'] || '';
          const referenceCode = fieldData['reference_code'] || fieldData['codigo_referencia'] || fieldData['ref'] || '';

          console.log(`Extracted: name=${name}, phone=${phone}, email=${email}, ref=${referenceCode}`);

          // Get ad info if available
          let adName = '';
          let campaignName = '';
          let campaignId = '';

          if (adId) {
            try {
              const adResponse = await fetch(
                `https://graph.facebook.com/v19.0/${adId}?fields=name,campaign{id,name}&access_token=${tokenData.access_token}`
              );
              const adData = await adResponse.json();
              if (!adData.error) {
                adName = adData.name || '';
                campaignName = adData.campaign?.name || '';
                campaignId = adData.campaign?.id || '';
                console.log(`✅ Ad info: name=${adName}, campaign=${campaignName}`);
              } else {
                console.log('⚠️ Could not fetch ad info:', adData.error);
              }
            } catch (e) {
              console.log('⚠️ Error fetching ad info:', e);
            }
          }

          // Check if lead already exists (by meta_lead_id)
          const { data: existingLead } = await supabase
            .from('leads')
            .select('id')
            .eq('meta_lead_id', leadgenId)
            .single();

          if (existingLead) {
            console.log(`⚠️ Lead ${leadgenId} already exists (id: ${existingLead.id}), skipping`);
            continue;
          }

          // Find property by reference code
          let propertyId = null;
          if (referenceCode) {
            const { data: property } = await supabase
              .from('properties')
              .select('id')
              .eq('account_id', metaConfig.account_id)
              .eq('reference_code', referenceCode)
              .single();

            if (property) {
              propertyId = property.id;
              console.log(`✅ Matched property by reference code: ${referenceCode} -> ${propertyId}`);
            } else {
              console.log(`⚠️ No property found with reference code: ${referenceCode}`);
            }
          }

          // Get "Novo Lead" status (by name, ensuring it's the first/default status)
          const { data: novoLeadStatus } = await supabase
            .from('lead_status')
            .select('id')
            .eq('account_id', metaConfig.account_id)
            .eq('name', 'Novo Lead')
            .single();

          // Fallback to default status if "Novo Lead" not found
          let statusId = novoLeadStatus?.id;
          if (!statusId) {
            const { data: defaultStatus } = await supabase
              .from('lead_status')
              .select('id')
              .eq('account_id', metaConfig.account_id)
              .eq('is_default', true)
              .single();
            statusId = defaultStatus?.id;
          }

          console.log(`Status ID for new lead: ${statusId}`);

          // Create the lead
          const leadInsert = {
            account_id: metaConfig.account_id,
            name,
            phone,
            email: email || null,
            origem: 'Facebook',
            campanha: campaignName || null,
            status_id: statusId,
            property_id: propertyId,
            meta_lead_id: leadgenId,
            meta_form_id: formId,
            meta_ad_id: adId,
            meta_campaign_id: campaignId,
            meta_ad_name: adName,
            meta_campaign_name: campaignName,
            temperature: 'warm',
          };

          console.log('Inserting lead:', JSON.stringify(leadInsert, null, 2));

          const { data: newLead, error: insertError } = await supabase
            .from('leads')
            .insert(leadInsert)
            .select('id')
            .single();

          if (insertError) {
            console.error('❌ Error creating lead:', insertError);
            continue;
          }

          console.log(`✅ Lead created successfully: ${newLead.id}`);

          // Store additional custom fields if any
          for (const [key, value] of Object.entries(fieldData)) {
            if (!['full_name', 'nome', 'name', 'phone_number', 'telefone', 'phone', 'email', 'reference_code', 'codigo_referencia', 'ref'].includes(key) && value) {
              // Check if there's a matching custom field
              const { data: customField } = await supabase
                .from('custom_fields')
                .select('id')
                .eq('account_id', metaConfig.account_id)
                .eq('field_key', key)
                .single();

              if (customField) {
                await supabase
                  .from('lead_custom_field_values')
                  .insert({
                    lead_id: newLead.id,
                    custom_field_id: customField.id,
                    value,
                  });
                console.log(`✅ Saved custom field: ${key}=${value}`);
              }
            }
          }

          // Log activity
          await supabase
            .from('lead_activities')
            .insert({
              lead_id: newLead.id,
              account_id: metaConfig.account_id,
              activity_type: 'created',
              description: `Lead criado automaticamente via Facebook Lead Ads${campaignName ? ` (Campanha: ${campaignName})` : ''}`,
            });
          console.log('✅ Activity logged');
        }
      }

      console.log('='.repeat(60));
      return new Response('OK', { status: 200, headers: corsHeaders });

    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      console.log('='.repeat(60));
      return new Response('OK', { status: 200, headers: corsHeaders }); // Always return 200 to Meta
    }
  }

  console.log(`Method not allowed: ${req.method}`);
  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
});
