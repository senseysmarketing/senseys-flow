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

// Normalize values for comparison (handles snake_case vs readable format)
function normalizeForComparison(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')  // underscores -> spaces
    .replace(/\s+/g, ' ') // multiple spaces -> single space
    .trim();
}

// Calculate lead temperature based on scoring rules
async function calculateLeadTemperature(
  supabase: any,
  accountId: string,
  formId: string,
  fieldData: Record<string, string>
): Promise<{ temperature: string; score: number; referenceCode: string | null }> {
  let temperature = 'warm'; // Default
  let score = 0;
  let referenceCode: string | null = null;

  try {
    // Get form config for this account and form
    const { data: formConfig, error: configError } = await supabase
      .from('meta_form_configs')
      .select('*')
      .eq('account_id', accountId)
      .eq('form_id', formId)
      .single();

    if (configError || !formConfig) {
      console.log(`No form config found for form ${formId}, creating one...`);
      
      // Auto-create form config
      const { data: newConfig, error: createError } = await supabase
        .from('meta_form_configs')
        .insert({
          account_id: accountId,
          form_id: formId,
          form_name: null,
          hot_threshold: 3,
          warm_threshold: 1,
          is_configured: false,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating form config:', createError);
      } else if (newConfig) {
        // Campos de dados básicos do lead que não devem ser criados como regras de scoring
        // Excluir apenas dados básicos do lead (NÃO excluir ref - ele precisa ser detectado para vinculação de imóveis)
        const excludedFields = ['full_name', 'full name', 'fullname', 'first_name', 'first name', 'nome', 'name', 'nome_completo', 'nome completo', 'email', 'e-mail', 'phone_number', 'telefone', 'phone', 'celular', 'whatsapp'];
        
        // Auto-create scoring rules for each field (exceto dados básicos)
        let rulesCreated = 0;
        for (const [fieldName, fieldValue] of Object.entries(fieldData)) {
          if (fieldValue && !excludedFields.includes(fieldName.toLowerCase())) {
            await supabase
              .from('meta_form_scoring_rules')
              .upsert({
                form_config_id: newConfig.id,
                question_name: fieldName,
                question_label: fieldName.replace(/_/g, ' ').replace(/\?/g, ''),
                answer_value: fieldValue,
                score: 0,
              }, {
                onConflict: 'form_config_id,question_name,answer_value',
              });
            rulesCreated++;
          }
        }
        console.log(`✅ Auto-created form config and ${rulesCreated} rules (excluded basic lead data fields)`);
      }

      return { temperature: 'warm', score: 0, referenceCode: null };
    }

    // Get scoring rules
    const { data: rules, error: rulesError } = await supabase
      .from('meta_form_scoring_rules')
      .select('*')
      .eq('form_config_id', formConfig.id);

    if (rulesError) {
      console.error('Error fetching scoring rules:', rulesError);
      return { temperature: 'warm', score: 0, referenceCode: null };
    }

    // Check for reference field
    if (formConfig.reference_field_name && fieldData[formConfig.reference_field_name]) {
      referenceCode = fieldData[formConfig.reference_field_name];
      console.log(`Found reference code from field "${formConfig.reference_field_name}": ${referenceCode}`);
    }

    // Calculate score
    for (const rule of rules || []) {
      const fieldValue = fieldData[rule.question_name];
      if (fieldValue && normalizeForComparison(fieldValue) === normalizeForComparison(rule.answer_value)) {
        score += rule.score;
        console.log(`Rule match: "${rule.question_name}" = "${fieldValue}" -> +${rule.score} (total: ${score})`);
      }
    }

    // Campos de dados básicos do lead que não devem ser criados como regras de scoring
    // Excluir apenas dados básicos do lead (NÃO excluir ref - ele precisa ser detectado para vinculação de imóveis)
    const excludedFields = ['full_name', 'full name', 'fullname', 'first_name', 'first name', 'nome', 'name', 'nome_completo', 'nome completo', 'email', 'e-mail', 'phone_number', 'telefone', 'phone', 'celular', 'whatsapp'];

    // Auto-register new answers that aren't in rules yet (exceto dados básicos)
    for (const [fieldName, fieldValue] of Object.entries(fieldData)) {
      if (!fieldValue) continue;
      if (excludedFields.includes(fieldName.toLowerCase())) continue;
      
      const existingRule = (rules || []).find(
        r => r.question_name === fieldName && normalizeForComparison(r.answer_value) === normalizeForComparison(fieldValue)
      );
      
      if (!existingRule) {
        await supabase
          .from('meta_form_scoring_rules')
          .upsert({
            form_config_id: formConfig.id,
            question_name: fieldName,
            question_label: fieldName.replace(/_/g, ' ').replace(/\?/g, ''),
            answer_value: fieldValue,
            score: 0,
          }, {
            onConflict: 'form_config_id,question_name,answer_value',
          });
        console.log(`Auto-registered new answer: "${fieldName}" = "${fieldValue}"`);
      }
    }

    // Determine temperature based on thresholds
    if (score >= formConfig.hot_threshold) {
      temperature = 'hot';
    } else if (score >= formConfig.warm_threshold) {
      temperature = 'warm';
    } else {
      temperature = 'cold';
    }

    console.log(`Final score: ${score}, Temperature: ${temperature} (hot >= ${formConfig.hot_threshold}, warm >= ${formConfig.warm_threshold})`);

  } catch (error) {
    console.error('Error calculating temperature:', error);
  }

  return { temperature, score, referenceCode };
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

          // Extract common fields - check multiple variations for name
          const name = fieldData['full_name'] || 
                       fieldData['full name'] || 
                       fieldData['fullname'] || 
                       fieldData['first_name'] || 
                       fieldData['first name'] || 
                       fieldData['nome'] || 
                       fieldData['name'] || 
                       fieldData['nome_completo'] || 
                       fieldData['nome completo'] || 
                       'Lead do Facebook';
          const phone = fieldData['phone_number'] || fieldData['telefone'] || fieldData['phone'] || fieldData['celular'] || fieldData['whatsapp'] || '';
          const email = fieldData['email'] || fieldData['e-mail'] || '';

          console.log(`Extracted: name=${name}, phone=${phone}, email=${email}`);

          // Calculate temperature and get reference code from scoring system
          const { temperature, score, referenceCode: scoringRefCode } = await calculateLeadTemperature(
            supabase,
            metaConfig.account_id,
            formId,
            fieldData
          );

          // Also check common reference code fields as fallback
          const referenceCode = scoringRefCode || 
            fieldData['reference_code'] || 
            fieldData['codigo_referencia'] || 
            fieldData['ref'] || 
            fieldData['código_de_referência'] ||
            fieldData['codigo_imovel'] ||
            '';

          console.log(`Temperature: ${temperature}, Score: ${score}, Reference Code: ${referenceCode}`);

          // Get ad info if available
          let adName = '';
          let campaignName = '';
          let campaignId = '';
          let isInstagram = false;

          if (adId) {
            try {
              const adResponse = await fetch(
                `https://graph.facebook.com/v19.0/${adId}?fields=name,campaign{id,name},effective_instagram_media_id&access_token=${tokenData.access_token}`
              );
              const adData = await adResponse.json();
              if (!adData.error) {
                adName = adData.name || '';
                campaignName = adData.campaign?.name || '';
                campaignId = adData.campaign?.id || '';
                // Detect if lead came from Instagram
                isInstagram = !!adData.effective_instagram_media_id;
                console.log(`✅ Ad info: name=${adName}, campaign=${campaignName}, isInstagram=${isInstagram}`);
              } else {
                console.log('⚠️ Could not fetch ad info:', adData.error);
              }
            } catch (e) {
              console.log('⚠️ Error fetching ad info:', e);
            }
          }

          // Get ad set (adgroup) info if available
          let adsetName = '';
          if (adgroupId) {
            try {
              const adsetResponse = await fetch(
                `https://graph.facebook.com/v19.0/${adgroupId}?fields=name&access_token=${tokenData.access_token}`
              );
              const adsetData = await adsetResponse.json();
              if (!adsetData.error) {
                adsetName = adsetData.name || '';
                console.log(`✅ Ad Set info: name=${adsetName}`);
              } else {
                console.log('⚠️ Could not fetch ad set info:', adsetData.error);
              }
            } catch (e) {
              console.log('⚠️ Error fetching ad set info:', e);
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

          // Create the lead with calculated temperature and enriched origin data
          const leadInsert = {
            account_id: metaConfig.account_id,
            name,
            phone,
            email: email || null,
            origem: isInstagram ? 'Instagram' : 'Facebook',
            campanha: campaignName || null,
            conjunto: adsetName || null,
            anuncio: adName || null,
            status_id: statusId,
            property_id: propertyId,
            meta_lead_id: leadgenId,
            meta_form_id: formId,
            meta_ad_id: adId,
            meta_campaign_id: campaignId,
            meta_ad_name: adName,
            meta_campaign_name: campaignName,
            temperature, // Use calculated temperature
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
          // Exclude basic lead data fields that are already stored in the leads table
          const excludedFields = [
            'full_name', 'full name', 'fullname', 'nome', 'name', 'nome_completo', 'nome completo',
            'phone_number', 'telefone', 'phone', 'celular', 'whatsapp',
            'email', 'e-mail',
            'reference_code', 'codigo_referencia', 'ref', 'código_de_referência', 'codigo_imovel', 'imovel_ref'
          ];

          for (const [key, value] of Object.entries(fieldData)) {
            if (!excludedFields.includes(key) && value) {
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
              } else {
                // Auto-create custom field if it doesn't exist
                const { data: newCustomField, error: cfError } = await supabase
                  .from('custom_fields')
                  .insert({
                    account_id: metaConfig.account_id,
                    name: key.replace(/_/g, ' ').replace(/\?/g, ''),
                    field_key: key,
                    field_type: 'text',
                    is_active: true,
                    is_required: false,
                  })
                  .select('id')
                  .single();

                if (!cfError && newCustomField) {
                  await supabase
                    .from('lead_custom_field_values')
                    .insert({
                      lead_id: newLead.id,
                      custom_field_id: newCustomField.id,
                      value,
                    });
                  console.log(`✅ Auto-created and saved custom field: ${key}=${value}`);
                }
              }
            }
          }

          // Log activity with temperature info
          await supabase
            .from('lead_activities')
            .insert({
              lead_id: newLead.id,
              account_id: metaConfig.account_id,
              activity_type: 'created',
              description: `Lead criado automaticamente via Facebook Lead Ads${campaignName ? ` (Campanha: ${campaignName})` : ''} - Temperatura: ${temperature === 'hot' ? 'Quente' : temperature === 'warm' ? 'Morno' : 'Frio'} (Score: ${score})`,
            });
          console.log('✅ Activity logged');

          // Send email notifications
          try {
            // Get property name if linked
            let propertyName: string | null = null;
            if (leadInsert.property_id) {
              const { data: property } = await supabase
                .from('properties')
                .select('title')
                .eq('id', leadInsert.property_id)
                .single();
              propertyName = property?.title || null;
            }

            await supabase.functions.invoke('notify-new-lead', {
              body: {
                lead_id: newLead.id,
                lead_name: leadInsert.name,
                lead_phone: leadInsert.phone,
                lead_email: leadInsert.email,
                lead_temperature: temperature,
                lead_origem: 'Facebook Lead Ads',
                property_name: propertyName,
                account_id: metaConfig.account_id,
              }
            });
            console.log('✅ Notification function invoked');
          } catch (notifyError) {
            console.error('Error invoking notify-new-lead:', notifyError);
            // Don't fail lead creation if notification fails
          }

          // Send Meta CAPI event for hot leads automatically
          if (temperature === 'hot') {
            try {
              // Check if pixel is configured
              const { data: metaConfigWithPixel } = await supabase
                .from('account_meta_config')
                .select('pixel_id')
                .eq('account_id', metaConfig.account_id)
                .single();

              if (metaConfigWithPixel?.pixel_id) {
                // Generate unique event_id
                const timestamp = Math.floor(Date.now() / 1000);
                const eventId = `${newLead.id}_Lead_qualified_${timestamp}`;

                // Hash email and phone
                const hashData = async (data: string): Promise<string> => {
                  const encoder = new TextEncoder();
                  const dataBuffer = encoder.encode(data);
                  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
                  return Array.from(new Uint8Array(hashBuffer))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
                };

                const userData: Record<string, any> = {};
                if (leadgenId) userData.lead_id = leadgenId;
                if (email) userData.em = [await hashData(email.toLowerCase().trim())];
                if (phone) {
                  let normalizedPhone = phone.replace(/\D/g, '');
                  if (normalizedPhone.length === 11 || normalizedPhone.length === 10) {
                    normalizedPhone = '55' + normalizedPhone;
                  }
                  userData.ph = [await hashData(normalizedPhone)];
                }

                const eventPayload = {
                  data: [{
                    event_name: 'Lead',
                    event_time: timestamp,
                    event_id: eventId,
                    action_source: 'system_generated',
                    user_data: userData,
                    custom_data: {
                      lead_event_source: 'Senseys CRM',
                      event_source: 'crm',
                      lead_type: 'qualified',
                      qualification_score: score,
                    },
                  }],
                };

                console.log('🔥 Sending CAPI event for hot lead:', JSON.stringify(eventPayload, null, 2));

                const capiResponse = await fetch(
                  `https://graph.facebook.com/v19.0/${metaConfigWithPixel.pixel_id}/events?access_token=${tokenData.access_token}`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(eventPayload),
                  }
                );

                const capiResult = await capiResponse.json();
                console.log(`CAPI response (${capiResponse.status}):`, JSON.stringify(capiResult, null, 2));

                // Log the event
                await supabase
                  .from('meta_capi_events_log')
                  .insert({
                    lead_id: newLead.id,
                    account_id: metaConfig.account_id,
                    event_name: 'Lead',
                    event_id: eventId,
                    pixel_id: metaConfigWithPixel.pixel_id,
                    status_code: capiResponse.status,
                    response_body: capiResult,
                    error_message: capiResult.error?.message || null,
                  });

                if (capiResult.error) {
                  console.error('❌ CAPI error:', capiResult.error);
                } else {
                  console.log('✅ CAPI event sent successfully for hot lead');
                }
              }
            } catch (capiError) {
              console.error('❌ Error sending CAPI event:', capiError);
              // Don't fail the lead creation if CAPI fails
            }
          } else {
            console.log(`ℹ️ Lead temperature: ${temperature} (score: ${score}) - No automatic CAPI event`);
          }
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
