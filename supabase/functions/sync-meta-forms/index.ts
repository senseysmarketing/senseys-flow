import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Campos básicos que não devem virar regras de qualificação
const EXCLUDED_FIELD_TYPES = ['FULL_NAME', 'EMAIL', 'PHONE', 'CITY', 'STATE', 'COUNTRY', 'ZIP', 'DATE_OF_BIRTH'];
const EXCLUDED_FIELD_KEYS = [
  'full_name', 'fullname', 'nome', 'name', 'first_name', 'last_name', 'nome_completo',
  'email', 'e-mail', 'work_email',
  'phone_number', 'phone', 'telefone', 'celular', 'whatsapp', 'mobile',
  'ref', 'reference_code', 'codigo_referencia', 'codigo_imovel', 'property_ref', 'imovel_ref',
  'street_address', 'city', 'state', 'zip_code', 'country', 'address'
];

// Keys que indicam campos de código de referência de imóvel
const REFERENCE_FIELD_KEYS = [
  'ref', 'reference_code', 'codigo_referencia', 'codigo_imovel', 'property_ref', 'imovel_ref'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's account_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.account_id) {
      return new Response(JSON.stringify({ error: 'Account not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accountId = profile.account_id;

    // Get account's Meta configuration (page_id needed)
    const { data: metaConfig } = await supabase
      .from('account_meta_config')
      .select('page_id, page_name')
      .eq('account_id', accountId)
      .single();

    if (!metaConfig?.page_id) {
      return new Response(JSON.stringify({ 
        error: 'Meta page not configured',
        message: 'Configure uma página Meta na aba Integração primeiro'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Meta agency token
    const { data: tokenData } = await supabase
      .from('meta_agency_token')
      .select('access_token')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single();

    if (!tokenData?.access_token) {
      return new Response(JSON.stringify({ error: 'Meta not connected at agency level' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = tokenData.access_token;
    const pageId = metaConfig.page_id;

    // Get page access token with full pagination
    let allPages: any[] = [];
    let nextUrl: string | null = `https://graph.facebook.com/v19.0/me/accounts?fields=id,access_token,name&limit=100&access_token=${accessToken}`;
    
    while (nextUrl) {
      const pagesResponse = await fetch(nextUrl);
      const pagesData = await pagesResponse.json();
      
      if (pagesData.error) {
        console.error('Error fetching pages:', pagesData.error);
        return new Response(JSON.stringify({ error: pagesData.error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      allPages = [...allPages, ...(pagesData.data || [])];
      nextUrl = pagesData.paging?.next || null;
      
      console.log(`Fetched ${pagesData.data?.length || 0} pages, total so far: ${allPages.length}`);
    }

    console.log(`Found ${allPages.length} total pages, looking for page ID: ${pageId}`);

    const page = allPages.find((p: any) => p.id === pageId);
    const pageToken = page?.access_token;

    if (!pageToken) {
      console.error(`Page ${pageId} (${metaConfig.page_name}) not found in ${allPages.length} available pages`);
      return new Response(JSON.stringify({ 
        error: 'Page token not found',
        message: `A página "${metaConfig.page_name}" (ID: ${pageId}) não foi encontrada entre ${allPages.length} páginas disponíveis. Isso pode ocorrer se a página foi desconectada ou se as permissões foram alteradas. Peça ao administrador da agência para reconfigurar a integração Meta.`,
        availablePages: allPages.map((p: any) => ({ id: p.id, name: p.name }))
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found page token for ${page.name}`);

    const url = new URL(req.url);
    let action = url.searchParams.get('action');
    
    // Support action from body as well for supabase.functions.invoke
    let bodyData: any = {};
    try {
      const text = await req.text();
      if (text) {
        bodyData = JSON.parse(text);
        if (bodyData.action) {
          action = bodyData.action;
        }
      }
    } catch {
      // Body might not be JSON, ignore
    }

    // LIST FORMS - List all available forms from the page
    if (action === 'list-forms') {
      console.log(`Listing forms for page ${pageId}...`);

      const formsResponse = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/leadgen_forms?fields=id,name,status,questions_count,created_time&limit=100&access_token=${pageToken}`
      );
      const formsData = await formsResponse.json();

      if (formsData.error) {
        console.error('Error fetching forms:', formsData.error);
        return new Response(JSON.stringify({ error: formsData.error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check which forms are already imported
      const { data: existingConfigs } = await supabase
        .from('meta_form_configs')
        .select('form_id')
        .eq('account_id', accountId);

      const importedFormIds = new Set(existingConfigs?.map(c => c.form_id) || []);

      const forms = (formsData.data || []).map((form: any) => ({
        id: form.id,
        name: form.name,
        status: form.status,
        questionsCount: form.questions_count || 0,
        createdTime: form.created_time,
        isImported: importedFormIds.has(form.id),
      }));

      console.log(`Found ${forms.length} forms, ${importedFormIds.size} already imported`);

      return new Response(JSON.stringify({ forms }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // SYNC FORM - Sync a specific form's questions
    if (action === 'sync-form') {
      const { form_id } = bodyData;

      if (!form_id) {
        return new Response(JSON.stringify({ error: 'form_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Syncing form ${form_id}...`);

      // Fetch form details with questions
      const formResponse = await fetch(
        `https://graph.facebook.com/v19.0/${form_id}?fields=id,name,status,questions&access_token=${pageToken}`
      );
      const formData = await formResponse.json();

      if (formData.error) {
        console.error('Error fetching form details:', formData.error);
        return new Response(JSON.stringify({ error: formData.error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Form ${formData.name} has ${formData.questions?.length || 0} questions`);

      // Create or update form config - preserve user's is_configured/thresholds
      const { data: existingFormConfig } = await supabase
        .from('meta_form_configs')
        .select('*')
        .eq('account_id', accountId)
        .eq('form_id', form_id)
        .single();

      let formConfig: any = existingFormConfig;
      let configError: any = null;

      if (existingFormConfig) {
        // Only update form_name, never overwrite is_configured/thresholds
        const { data: updated, error: updErr } = await supabase
          .from('meta_form_configs')
          .update({ form_name: formData.name })
          .eq('id', existingFormConfig.id)
          .select()
          .single();
        formConfig = updated || existingFormConfig;
        configError = updErr;
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from('meta_form_configs')
          .insert({
            account_id: accountId,
            form_id: form_id,
            form_name: formData.name,
            source_type: 'meta',
            is_configured: false,
            hot_threshold: 3,
            warm_threshold: 1,
          })
          .select()
          .single();
        formConfig = inserted;
        configError = insErr;
      }

      if (configError) {
        // Try to get existing config if upsert failed
        const { data: existingConfig } = await supabase
          .from('meta_form_configs')
          .select('*')
          .eq('account_id', accountId)
          .eq('form_id', form_id)
          .single();

        if (!existingConfig) {
          console.error('Error creating form config:', configError);
          return new Response(JSON.stringify({ error: configError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Use existing config
        const formConfigId = existingConfig.id;
        
        // Process questions and create scoring rules
        const questions = formData.questions || [];
        let rulesCreated = 0;
        let detectedRefField: string | null = null;

        for (const question of questions) {
          // Skip basic data fields
          const keyLower = (question.key || '').toLowerCase();
          
          // Detect reference fields
          if (REFERENCE_FIELD_KEYS.includes(keyLower) && !detectedRefField) {
            detectedRefField = question.key;
            console.log(`Detected reference field: ${question.key}`);
          }
          
          if (EXCLUDED_FIELD_TYPES.includes(question.type) || EXCLUDED_FIELD_KEYS.includes(keyLower)) {
            console.log(`Skipping excluded field: ${question.key} (type: ${question.type})`);
            continue;
          }

          // Only process questions with options (multiple choice)
          if (question.options && question.options.length > 0) {
            for (const option of question.options) {
              // Check if rule already exists
              const { data: existingRule } = await supabase
                .from('meta_form_scoring_rules')
                .select('id')
                .eq('form_config_id', formConfigId)
                .eq('question_name', question.key)
                .eq('answer_value', option.value || option.key)
                .single();

              if (!existingRule) {
                const { error: ruleError } = await supabase
                  .from('meta_form_scoring_rules')
                  .insert({
                    form_config_id: formConfigId,
                    question_name: question.key,
                    question_label: question.label || question.key,
                    answer_value: option.value || option.key,
                    score: 0,
                  });

                if (ruleError) {
                  console.error('Error creating rule:', ruleError);
                } else {
                  rulesCreated++;
                }
              }
            }
          }
        }

        // Auto-set reference_field_name if detected and not yet configured
        if (detectedRefField) {
          await supabase
            .from('meta_form_configs')
            .update({ reference_field_name: detectedRefField })
            .eq('id', formConfigId)
            .is('reference_field_name', null);
        }

        console.log(`Created ${rulesCreated} scoring rules for form ${form_id}`);

        return new Response(JSON.stringify({ 
          success: true, 
          formName: formData.name,
          questionsProcessed: questions.length,
          rulesCreated 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const formConfigId = formConfig.id;

      // Process questions and create scoring rules
      const questions = formData.questions || [];
      let rulesCreated = 0;
      let detectedRefField2: string | null = null;

      for (const question of questions) {
        // Skip basic data fields
        const keyLower = (question.key || '').toLowerCase();
        
        // Detect reference fields
        if (REFERENCE_FIELD_KEYS.includes(keyLower) && !detectedRefField2) {
          detectedRefField2 = question.key;
          console.log(`Detected reference field: ${question.key}`);
        }
        
        if (EXCLUDED_FIELD_TYPES.includes(question.type) || EXCLUDED_FIELD_KEYS.includes(keyLower)) {
          console.log(`Skipping excluded field: ${question.key} (type: ${question.type})`);
          continue;
        }

        // Only process questions with options (multiple choice)
        if (question.options && question.options.length > 0) {
          for (const option of question.options) {
            // Check if rule already exists
            const { data: existingRule } = await supabase
              .from('meta_form_scoring_rules')
              .select('id')
              .eq('form_config_id', formConfigId)
              .eq('question_name', question.key)
              .eq('answer_value', option.value || option.key)
              .single();

            if (!existingRule) {
              const { error: ruleError } = await supabase
                .from('meta_form_scoring_rules')
                .insert({
                  form_config_id: formConfigId,
                  question_name: question.key,
                  question_label: question.label || question.key,
                  answer_value: option.value || option.key,
                  score: 0,
                });

              if (ruleError) {
                console.error('Error creating rule:', ruleError);
              } else {
                rulesCreated++;
              }
            }
          }
        }
      }

      // Auto-set reference_field_name if detected and not yet configured
      if (detectedRefField2) {
        await supabase
          .from('meta_form_configs')
          .update({ reference_field_name: detectedRefField2 })
          .eq('id', formConfigId)
          .is('reference_field_name', null);
      }

      console.log(`Created ${rulesCreated} scoring rules for form ${form_id}`);

      return new Response(JSON.stringify({ 
        success: true, 
        formName: formData.name,
        questionsProcessed: questions.length,
        rulesCreated 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // SYNC ALL FORMS - Sync all forms at once
    if (action === 'sync-all') {
      console.log(`Syncing all forms for page ${pageId}...`);

      // First list all forms
      const formsResponse = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/leadgen_forms?fields=id,name&limit=100&access_token=${pageToken}`
      );
      const formsData = await formsResponse.json();

      if (formsData.error) {
        console.error('Error fetching forms:', formsData.error);
        return new Response(JSON.stringify({ error: formsData.error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const forms = formsData.data || [];
      let totalRulesCreated = 0;
      const syncedForms: string[] = [];

      for (const form of forms) {
        try {
          // Fetch form details with questions
          const formResponse = await fetch(
            `https://graph.facebook.com/v19.0/${form.id}?fields=id,name,questions&access_token=${pageToken}`
          );
          const formData = await formResponse.json();

          if (formData.error) {
            console.error(`Error fetching form ${form.id}:`, formData.error);
            continue;
          }

          // Create or update form config
          const { data: formConfig, error: configError } = await supabase
            .from('meta_form_configs')
            .upsert({
              account_id: accountId,
              form_id: form.id,
              form_name: formData.name,
              source_type: 'meta',
              is_configured: false,
              hot_threshold: 3,
              warm_threshold: 1,
            }, {
              onConflict: 'account_id,form_id',
              ignoreDuplicates: false
            })
            .select()
            .single();

          let formConfigId = formConfig?.id;

          if (configError || !formConfigId) {
            // Try to get existing config
            const { data: existingConfig } = await supabase
              .from('meta_form_configs')
              .select('id')
              .eq('account_id', accountId)
              .eq('form_id', form.id)
              .single();

            if (existingConfig) {
              formConfigId = existingConfig.id;
            } else {
              console.error(`Could not get form config for ${form.id}`);
              continue;
            }
          }

          // Process questions
          const questions = formData.questions || [];
          let detectedRefFieldSync: string | null = null;
          for (const question of questions) {
            const keyLower = (question.key || '').toLowerCase();
            
            // Detect reference fields
            if (REFERENCE_FIELD_KEYS.includes(keyLower) && !detectedRefFieldSync) {
              detectedRefFieldSync = question.key;
            }
            
            if (EXCLUDED_FIELD_TYPES.includes(question.type) || EXCLUDED_FIELD_KEYS.includes(keyLower)) {
              continue;
            }

            if (question.options && question.options.length > 0) {
              for (const option of question.options) {
                const { data: existingRule } = await supabase
                  .from('meta_form_scoring_rules')
                  .select('id')
                  .eq('form_config_id', formConfigId)
                  .eq('question_name', question.key)
                  .eq('answer_value', option.value || option.key)
                  .single();

                if (!existingRule) {
                  const { error: ruleError } = await supabase
                    .from('meta_form_scoring_rules')
                    .insert({
                      form_config_id: formConfigId,
                      question_name: question.key,
                      question_label: question.label || question.key,
                      answer_value: option.value || option.key,
                      score: 0,
                    });

                  if (!ruleError) {
                    totalRulesCreated++;
                  }
                }
              }
            }
          }

          // Auto-set reference_field_name if detected and not yet configured
          if (detectedRefFieldSync) {
            await supabase
              .from('meta_form_configs')
              .update({ reference_field_name: detectedRefFieldSync })
              .eq('id', formConfigId)
              .is('reference_field_name', null);
          }

          syncedForms.push(formData.name);
        } catch (e) {
          console.error(`Error syncing form ${form.id}:`, e);
        }
      }

      console.log(`Synced ${syncedForms.length} forms with ${totalRulesCreated} new rules`);

      return new Response(JSON.stringify({ 
        success: true,
        formsCount: syncedForms.length,
        syncedForms,
        rulesCreated: totalRulesCreated
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Sync meta forms error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
