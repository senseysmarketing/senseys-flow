import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const VERIFY_TOKEN = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN') || '';
const META_APP_SECRET = Deno.env.get('META_APP_SECRET') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

// Common excluded fields (basic lead data)
const EXCLUDED_FIELDS = new Set([
  'full_name', 'full name', 'fullname', 'first_name', 'first name', 
  'nome', 'name', 'nome_completo', 'nome completo',
  'phone_number', 'telefone', 'phone', 'celular', 'whatsapp',
  'email', 'e-mail',
  'reference_code', 'codigo_referencia', 'ref', 'código_de_referência', 'codigo_imovel', 'imovel_ref'
]);

// Fields that are basic data but NOT ref fields (used for scoring)
const BASIC_DATA_FIELDS = new Set([
  'full_name', 'full name', 'fullname', 'first_name', 'first name', 
  'nome', 'name', 'nome_completo', 'nome completo',
  'phone_number', 'telefone', 'phone', 'celular', 'whatsapp',
  'email', 'e-mail'
]);

async function verifySignature(payload: string, signature: string): Promise<boolean> {
  if (!signature || !META_APP_SECRET) return false;
  const expectedSignature = signature.replace('sha256=', '');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(META_APP_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('') === expectedSignature;
}

function normalizeForComparison(value: string): string {
  return value.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function calculateLeadTemperature(supabase: any, accountId: string, formId: string, fieldData: Record<string, string>): Promise<{ temperature: string; score: number; referenceCode: string | null }> {
  let temperature = 'warm', score = 0, referenceCode: string | null = null;

  try {
    const { data: formConfig, error: configError } = await supabase
      .from('meta_form_configs').select('*').eq('account_id', accountId).eq('form_id', formId).single();

    if (configError || !formConfig) {
      console.log(`No form config for form ${formId}, creating...`);
      const { data: newConfig, error: createError } = await supabase
        .from('meta_form_configs')
        .insert({ account_id: accountId, form_id: formId, hot_threshold: 3, warm_threshold: 1, is_configured: false })
        .select().single();

      if (!createError && newConfig) {
        let rulesCreated = 0;
        for (const [fieldName, fieldValue] of Object.entries(fieldData)) {
          if (fieldValue && !BASIC_DATA_FIELDS.has(fieldName.toLowerCase())) {
            await supabase.from('meta_form_scoring_rules').upsert({
              form_config_id: newConfig.id, question_name: fieldName,
              question_label: fieldName.replace(/_/g, ' ').replace(/\?/g, ''),
              answer_value: fieldValue, score: 0,
            }, { onConflict: 'form_config_id,question_name,answer_value' });
            rulesCreated++;
          }
        }
        console.log(`✅ Created form config and ${rulesCreated} rules`);
      }
      return { temperature: 'warm', score: 0, referenceCode: null };
    }

    const { data: rules } = await supabase.from('meta_form_scoring_rules').select('*').eq('form_config_id', formConfig.id);
    
    if (formConfig.reference_field_name && fieldData[formConfig.reference_field_name]) {
      referenceCode = fieldData[formConfig.reference_field_name];
      console.log(`Found reference: ${referenceCode}`);
    }

    for (const rule of rules || []) {
      const fieldValue = fieldData[rule.question_name];
      if (fieldValue && normalizeForComparison(fieldValue) === normalizeForComparison(rule.answer_value)) {
        score += rule.score;
      }
    }

    for (const [fieldName, fieldValue] of Object.entries(fieldData)) {
      if (!fieldValue || BASIC_DATA_FIELDS.has(fieldName.toLowerCase())) continue;
      if (!(rules || []).find(r => r.question_name === fieldName && normalizeForComparison(r.answer_value) === normalizeForComparison(fieldValue))) {
        await supabase.from('meta_form_scoring_rules').upsert({
          form_config_id: formConfig.id, question_name: fieldName,
          question_label: fieldName.replace(/_/g, ' ').replace(/\?/g, ''),
          answer_value: fieldValue, score: 0,
        }, { onConflict: 'form_config_id,question_name,answer_value' });
      }
    }

    temperature = score >= formConfig.hot_threshold ? 'hot' : score >= formConfig.warm_threshold ? 'warm' : 'cold';
    console.log(`Score: ${score}, Temp: ${temperature}`);
  } catch (error) { console.error('Error calculating temp:', error); }

  return { temperature, score, referenceCode };
}

serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Diagnostic test
  if (url.searchParams.get('test') === 'true') {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: tokenData } = await supabase.from('meta_agency_token').select('id, user_name, created_at').eq('id', '00000000-0000-0000-0000-000000000001').single();
    const { data: configs } = await supabase.from('account_meta_config').select('account_id, page_id, ad_account_id, is_active');
    return new Response(JSON.stringify({
      status: 'Webhook active', verify_token_configured: !!VERIFY_TOKEN, app_secret_configured: !!META_APP_SECRET,
      meta_token: tokenData ? { exists: true, user_name: tokenData.user_name } : { exists: false },
      configured_accounts: configs || [],
    }, null, 2), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Webhook Verification (GET)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode'), token = url.searchParams.get('hub.verify_token'), challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verified');
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  // Handle webhook events (POST)
  if (req.method === 'POST') {
    try {
      const body = await req.text();
      const signature = req.headers.get('x-hub-signature-256');
      
      if (signature && META_APP_SECRET && !(await verifySignature(body, signature))) {
        return new Response('Invalid signature', { status: 401, headers: corsHeaders });
      }

      const data = JSON.parse(body);
      if (data.object !== 'page') return new Response('OK', { status: 200, headers: corsHeaders });

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: tokenData, error: tokenError } = await supabase.from('meta_agency_token').select('access_token').eq('id', '00000000-0000-0000-0000-000000000001').single();
      if (tokenError || !tokenData?.access_token) return new Response('OK', { status: 200, headers: corsHeaders });

      for (const entry of data.entry || []) {
        const pageId = entry.id;
        const { data: metaConfig } = await supabase.from('account_meta_config').select('account_id, ad_account_id').eq('page_id', pageId).eq('is_active', true).single();
        if (!metaConfig) continue;

        for (const change of entry.changes || []) {
          if (change.field !== 'leadgen') continue;
          const { leadgen_id: leadgenId, form_id: formId, ad_id: adId, adgroup_id: adgroupId } = change.value;

          const leadResponse = await fetch(`https://graph.facebook.com/v19.0/${leadgenId}?access_token=${tokenData.access_token}`);
          const leadData = await leadResponse.json();
          if (leadData.error) continue;

          const fieldData: Record<string, string> = {};
          for (const field of leadData.field_data || []) fieldData[field.name.toLowerCase()] = field.values?.[0] || '';

          const name = fieldData['full_name'] || fieldData['full name'] || fieldData['nome'] || fieldData['name'] || 'Lead do Facebook';
          const phone = fieldData['phone_number'] || fieldData['telefone'] || fieldData['phone'] || '';
          const email = fieldData['email'] || fieldData['e-mail'] || '';

          const { temperature, score, referenceCode: scoringRefCode } = await calculateLeadTemperature(supabase, metaConfig.account_id, formId, fieldData);
          const referenceCode = scoringRefCode || fieldData['reference_code'] || fieldData['ref'] || fieldData['codigo_referencia'] || '';

          let adName = '', campaignName = '', campaignId = '', isInstagram = false, adsetName = '';
          if (adId) {
            try {
              const adData = await (await fetch(`https://graph.facebook.com/v19.0/${adId}?fields=name,campaign{id,name},effective_instagram_media_id&access_token=${tokenData.access_token}`)).json();
              if (!adData.error) { adName = adData.name || ''; campaignName = adData.campaign?.name || ''; campaignId = adData.campaign?.id || ''; isInstagram = !!adData.effective_instagram_media_id; }
            } catch {}
          }
          if (adgroupId) {
            try {
              const adsetData = await (await fetch(`https://graph.facebook.com/v19.0/${adgroupId}?fields=name&access_token=${tokenData.access_token}`)).json();
              if (!adsetData.error) adsetName = adsetData.name || '';
            } catch {}
          }

          const { data: existingLead } = await supabase.from('leads').select('id').eq('meta_lead_id', leadgenId).single();
          if (existingLead) continue;

          let propertyId = null;
          if (referenceCode) {
            const { data: property } = await supabase.from('properties').select('id').eq('account_id', metaConfig.account_id).eq('reference_code', referenceCode).single();
            propertyId = property?.id || null;
          }

          const { data: statusData } = await supabase.from('lead_status').select('id').eq('account_id', metaConfig.account_id).eq('name', 'Novo Lead').single();
          let statusId = statusData?.id;
          if (!statusId) {
            const { data: defaultStatus } = await supabase.from('lead_status').select('id').eq('account_id', metaConfig.account_id).eq('is_default', true).single();
            statusId = defaultStatus?.id;
          }

          const { data: newLead, error: insertError } = await supabase.from('leads').insert({
            account_id: metaConfig.account_id, name, phone, email: email || null,
            origem: isInstagram ? 'Instagram' : 'Facebook', campanha: campaignName || null, conjunto: adsetName || null, anuncio: adName || null,
            status_id: statusId, property_id: propertyId, meta_lead_id: leadgenId, meta_form_id: formId,
            meta_ad_id: adId, meta_campaign_id: campaignId, meta_ad_name: adName, meta_campaign_name: campaignName, temperature,
          }).select('id').single();

          if (insertError) continue;
          console.log(`✅ Lead created: ${newLead.id}`);

          // Save form -> ref mapping
          if (formId && propertyId && referenceCode) {
            await supabase.from('meta_form_property_mapping').upsert({ account_id: metaConfig.account_id, form_id: formId, reference_code: referenceCode, property_id: propertyId }, { onConflict: 'account_id,form_id' });
          }

          // Apply distribution rules
          let assignedBrokerId: string | undefined;
          try {
            const distResult = await supabase.functions.invoke('apply-distribution-rules', { body: { lead_id: newLead.id, account_id: metaConfig.account_id } });
            if (distResult.data?.success) assignedBrokerId = distResult.data.broker_id;
          } catch {}

          // Store custom fields
          for (const [key, value] of Object.entries(fieldData)) {
            if (EXCLUDED_FIELDS.has(key) || !value) continue;
            const { data: customField } = await supabase.from('custom_fields').select('id').eq('account_id', metaConfig.account_id).eq('field_key', key).single();
            if (customField) {
              await supabase.from('lead_custom_field_values').insert({ lead_id: newLead.id, custom_field_id: customField.id, value });
            } else {
              const { data: newCF } = await supabase.from('custom_fields').insert({ account_id: metaConfig.account_id, name: key.replace(/_/g, ' '), field_key: key, field_type: 'text', is_active: true, is_required: false }).select('id').single();
              if (newCF) await supabase.from('lead_custom_field_values').insert({ lead_id: newLead.id, custom_field_id: newCF.id, value });
            }
          }

          // Log activity
          await supabase.from('lead_activities').insert({
            lead_id: newLead.id, account_id: metaConfig.account_id, activity_type: 'created',
            description: `Lead via Facebook Lead Ads${campaignName ? ` (${campaignName})` : ''} - ${temperature === 'hot' ? 'Quente' : temperature === 'warm' ? 'Morno' : 'Frio'} (Score: ${score})`,
          });

          // Send notifications
          try {
            let propertyName = null;
            if (propertyId) {
              const { data: prop } = await supabase.from('properties').select('title').eq('id', propertyId).single();
              propertyName = prop?.title || null;
            }
            await supabase.functions.invoke('notify-new-lead', {
              body: { lead_id: newLead.id, lead_name: name, lead_phone: phone, lead_email: email, lead_temperature: temperature, lead_origem: 'Facebook Lead Ads', property_name: propertyName, account_id: metaConfig.account_id, assigned_broker_id: assignedBrokerId }
            });
          } catch {}

          // CAPI for hot leads
          if (temperature === 'hot') {
            try {
              const { data: metaPixel } = await supabase.from('account_meta_config').select('pixel_id').eq('account_id', metaConfig.account_id).single();
              if (metaPixel?.pixel_id) {
                const timestamp = Math.floor(Date.now() / 1000);
                const eventId = `${newLead.id}_Lead_qualified_${timestamp}`;
                const userData: Record<string, any> = { lead_id: leadgenId };
                if (email) userData.em = [await hashData(email.toLowerCase().trim())];
                if (phone) {
                  let p = phone.replace(/\D/g, '');
                  if (p.length === 10 || p.length === 11) p = '55' + p;
                  userData.ph = [await hashData(p)];
                }
                const eventPayload = { data: [{ event_name: 'Lead', event_time: timestamp, event_id: eventId, action_source: 'system_generated', user_data: userData, custom_data: { lead_event_source: 'Senseys CRM', lead_type: 'qualified', qualification_score: score } }] };
                const capiRes = await fetch(`https://graph.facebook.com/v19.0/${metaPixel.pixel_id}/events?access_token=${tokenData.access_token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(eventPayload) });
                const capiResult = await capiRes.json();
                await supabase.from('meta_capi_events_log').insert({ lead_id: newLead.id, account_id: metaConfig.account_id, event_name: 'Lead', event_id: eventId, pixel_id: metaPixel.pixel_id, status_code: capiRes.status, response_body: capiResult, error_message: capiResult.error?.message || null });
              }
            } catch {}
          }
        }
      }

      return new Response('OK', { status: 200, headers: corsHeaders });
    } catch (error) {
      console.error('Webhook error:', error);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
});
