import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const VERIFY_TOKEN = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN')!;
const META_APP_SECRET = Deno.env.get('META_APP_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

// Verify Meta webhook signature
async function verifySignature(payload: string, signature: string): Promise<boolean> {
  if (!signature) return false;
  
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

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Meta Webhook Verification (GET request)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('Webhook verification request:', { mode, token, challenge });

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verified successfully');
      return new Response(challenge, { status: 200 });
    }

    console.log('Webhook verification failed - token mismatch');
    return new Response('Forbidden', { status: 403 });
  }

  // Handle incoming webhook events (POST request)
  if (req.method === 'POST') {
    try {
      const body = await req.text();
      const signature = req.headers.get('x-hub-signature-256');

      // Verify signature in production
      if (signature && META_APP_SECRET) {
        const isValid = await verifySignature(body, signature);
        if (!isValid) {
          console.error('Invalid webhook signature');
          return new Response('Invalid signature', { status: 401 });
        }
      }

      const data = JSON.parse(body);
      console.log('Received Meta webhook:', JSON.stringify(data, null, 2));

      // Check if this is a leadgen event
      if (data.object !== 'page') {
        console.log('Not a page event, ignoring');
        return new Response('OK', { status: 200 });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Get the Meta token for API calls
      const { data: tokenData } = await supabase
        .from('meta_agency_token')
        .select('access_token')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .single();

      if (!tokenData?.access_token) {
        console.error('No Meta token found');
        return new Response('OK', { status: 200 });
      }

      // Process each entry
      for (const entry of data.entry || []) {
        const pageId = entry.id;

        // Find which account this page belongs to
        const { data: metaConfig } = await supabase
          .from('account_meta_config')
          .select('account_id, ad_account_id')
          .eq('page_id', pageId)
          .eq('is_active', true)
          .single();

        if (!metaConfig) {
          console.log(`No active config found for page ${pageId}`);
          continue;
        }

        // Process leadgen changes
        for (const change of entry.changes || []) {
          if (change.field !== 'leadgen') continue;

          const leadgenId = change.value.leadgen_id;
          const formId = change.value.form_id;
          const adId = change.value.ad_id;
          const adgroupId = change.value.adgroup_id;

          console.log(`Processing lead ${leadgenId} for account ${metaConfig.account_id}`);

          // Fetch lead details from Meta API
          const leadResponse = await fetch(
            `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${tokenData.access_token}`
          );
          const leadData = await leadResponse.json();

          if (leadData.error) {
            console.error('Error fetching lead data:', leadData.error);
            continue;
          }

          console.log('Lead data from Meta:', JSON.stringify(leadData, null, 2));

          // Parse lead fields
          const fieldData: Record<string, string> = {};
          for (const field of leadData.field_data || []) {
            fieldData[field.name.toLowerCase()] = field.values?.[0] || '';
          }

          // Extract common fields
          const name = fieldData['full_name'] || fieldData['nome'] || fieldData['name'] || 'Lead do Facebook';
          const phone = fieldData['phone_number'] || fieldData['telefone'] || fieldData['phone'] || '';
          const email = fieldData['email'] || '';
          const referenceCode = fieldData['reference_code'] || fieldData['codigo_referencia'] || fieldData['ref'] || '';

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
              }
            } catch (e) {
              console.log('Could not fetch ad info:', e);
            }
          }

          // Check if lead already exists (by meta_lead_id)
          const { data: existingLead } = await supabase
            .from('leads')
            .select('id')
            .eq('meta_lead_id', leadgenId)
            .single();

          if (existingLead) {
            console.log(`Lead ${leadgenId} already exists, skipping`);
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
              console.log(`Matched property by reference code: ${referenceCode}`);
            }
          }

          // Get default status
          const { data: defaultStatus } = await supabase
            .from('lead_status')
            .select('id')
            .eq('account_id', metaConfig.account_id)
            .eq('is_default', true)
            .single();

          // Create the lead
          const leadInsert = {
            account_id: metaConfig.account_id,
            name,
            phone,
            email: email || null,
            origem: 'Facebook',
            campanha: campaignName || null,
            status_id: defaultStatus?.id || null,
            property_id: propertyId,
            meta_lead_id: leadgenId,
            meta_form_id: formId,
            meta_ad_id: adId,
            meta_campaign_id: campaignId,
            meta_ad_name: adName,
            meta_campaign_name: campaignName,
            temperature: 'warm',
          };

          const { data: newLead, error: insertError } = await supabase
            .from('leads')
            .insert(leadInsert)
            .select('id')
            .single();

          if (insertError) {
            console.error('Error creating lead:', insertError);
            continue;
          }

          console.log(`Lead created successfully: ${newLead.id}`);

          // Store additional custom fields if any
          const customFieldMappings = [
            'interesse', 'interest', 'observacoes', 'observation', 'message', 'mensagem'
          ];

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
              }
            }
          }
        }
      }

      return new Response('OK', { status: 200 });

    } catch (error) {
      console.error('Webhook processing error:', error);
      return new Response('OK', { status: 200 }); // Always return 200 to Meta
    }
  }

  return new Response('Method not allowed', { status: 405 });
});
