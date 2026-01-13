import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FormConfig {
  id: string;
  hot_threshold: number;
  warm_threshold: number;
  reference_field_name: string | null;
}

interface ScoringRule {
  question_name: string;
  answer_value: string;
  score: number;
}

// Normalize values for comparison (handles snake_case vs readable format)
const normalizeForComparison = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')  // underscores -> spaces
    .replace(/\s+/g, ' ') // multiple spaces -> single space
    .trim();
};

// Calculate lead temperature based on scoring rules
const calculateLeadTemperature = (
  formFields: Record<string, string>,
  rules: ScoringRule[],
  config: FormConfig
): string => {
  let totalScore = 0;

  for (const [fieldName, fieldValue] of Object.entries(formFields)) {
    const matchingRule = rules.find(
      (r) => normalizeForComparison(r.question_name) === normalizeForComparison(fieldName) &&
             normalizeForComparison(r.answer_value) === normalizeForComparison(String(fieldValue))
    );
    if (matchingRule) {
      totalScore += matchingRule.score;
      console.log(`Scoring rule matched: ${fieldName}="${fieldValue}" -> +${matchingRule.score}`);
    }
  }

  console.log(`Total score: ${totalScore}, Hot threshold: ${config.hot_threshold}, Warm threshold: ${config.warm_threshold}`);

  if (totalScore >= config.hot_threshold) {
    return 'hot';
  } else if (totalScore >= config.warm_threshold) {
    return 'warm';
  } else {
    return 'cold';
  }
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

    // Validate property_id if provided
    let validPropertyId: string | null = null;
    if (body.property_id) {
      console.log('Validating property_id:', body.property_id);
      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .select('id')
        .eq('id', body.property_id)
        .eq('account_id', accountId)
        .single();

      if (propertyError || !property) {
        console.log('Property not found or not owned by account, lead will be created without property link');
      } else {
        validPropertyId = property.id;
        console.log('Property validated successfully:', validPropertyId);
      }
    }

    // Handle form-based qualification for webhook leads
    let calculatedTemperature = 'warm'; // default
    let formConfigId: string | null = null;
    const formId = body.form_id;
    const formName = body.form_name;
    const formFields = body.form_fields as Record<string, string> | undefined;

    if (formId && formFields && Object.keys(formFields).length > 0) {
      console.log('Processing form-based qualification:', formId, formFields);

      // Check if form config exists
      let { data: existingConfig } = await supabase
        .from('meta_form_configs')
        .select('id, hot_threshold, warm_threshold, reference_field_name')
        .eq('form_id', formId)
        .eq('account_id', accountId)
        .eq('source_type', 'webhook')
        .single();

      if (!existingConfig) {
        // Create new form config for this webhook form
        console.log('Creating new webhook form config:', formId);
        const { data: newConfig, error: configError } = await supabase
          .from('meta_form_configs')
          .insert({
            account_id: accountId,
            form_id: formId,
            form_name: formName || `Webhook Form ${formId}`,
            source_type: 'webhook',
            hot_threshold: 3,
            warm_threshold: 1,
            is_configured: false,
          })
          .select()
          .single();

        if (configError) {
          console.error('Error creating form config:', configError);
        } else {
          existingConfig = newConfig;
          formConfigId = newConfig.id;

          // Auto-create scoring rules for detected fields
          const rulesToInsert = [];
          for (const [fieldName, fieldValue] of Object.entries(formFields)) {
            // Skip basic lead data fields
            // Excluir apenas dados básicos do lead (NÃO excluir ref - ele precisa ser detectado para vinculação de imóveis)
            const excludedFields = ['name', 'nome', 'full_name', 'email', 'e-mail', 'phone', 'phone_number', 'telefone', 'celular', 'whatsapp'];
            if (excludedFields.includes(fieldName.toLowerCase())) continue;

            rulesToInsert.push({
              form_config_id: newConfig.id,
              question_name: fieldName,
              question_label: fieldName,
              answer_value: String(fieldValue),
              score: 0, // Default neutral score
            });
          }

          if (rulesToInsert.length > 0) {
            const { error: rulesError } = await supabase
              .from('meta_form_scoring_rules')
              .insert(rulesToInsert);
            if (rulesError) {
              console.error('Error creating scoring rules:', rulesError);
            } else {
              console.log(`Created ${rulesToInsert.length} scoring rules`);
            }
          }
        }
      } else {
        formConfigId = existingConfig.id;

        // Check for new field/value combinations and add them as rules
        const { data: existingRules } = await supabase
          .from('meta_form_scoring_rules')
          .select('question_name, answer_value')
          .eq('form_config_id', existingConfig.id);

        const existingRulesSet = new Set(
          (existingRules || []).map((r) => `${r.question_name.toLowerCase()}|${r.answer_value.toLowerCase()}`)
        );

        const newRulesToInsert = [];
        for (const [fieldName, fieldValue] of Object.entries(formFields)) {
          // Excluir apenas dados básicos do lead (NÃO excluir ref - ele precisa ser detectado para vinculação de imóveis)
          const excludedFields = ['name', 'nome', 'full_name', 'email', 'e-mail', 'phone', 'phone_number', 'telefone', 'celular', 'whatsapp'];
          if (excludedFields.includes(fieldName.toLowerCase())) continue;

          const key = `${fieldName.toLowerCase()}|${String(fieldValue).toLowerCase()}`;
          if (!existingRulesSet.has(key)) {
            newRulesToInsert.push({
              form_config_id: existingConfig.id,
              question_name: fieldName,
              question_label: fieldName,
              answer_value: String(fieldValue),
              score: 0,
            });
          }
        }

        if (newRulesToInsert.length > 0) {
          const { error: rulesError } = await supabase
            .from('meta_form_scoring_rules')
            .insert(newRulesToInsert);
          if (rulesError) {
            console.error('Error creating new scoring rules:', rulesError);
          } else {
            console.log(`Added ${newRulesToInsert.length} new scoring rules`);
          }
        }

        // Calculate temperature if config exists
        if (existingConfig.is_configured !== false) {
          const { data: scoringRules } = await supabase
            .from('meta_form_scoring_rules')
            .select('question_name, answer_value, score')
            .eq('form_config_id', existingConfig.id);

          if (scoringRules && scoringRules.length > 0) {
            calculatedTemperature = calculateLeadTemperature(
              formFields,
              scoringRules,
              existingConfig as FormConfig
            );
            console.log('Calculated temperature:', calculatedTemperature);
          }
        }

        // Check for property reference field (configured field first)
        if (existingConfig.reference_field_name && formFields[existingConfig.reference_field_name]) {
          const referenceCode = formFields[existingConfig.reference_field_name];
          console.log('Looking for property with reference code:', referenceCode);

          const { data: matchedProperty } = await supabase
            .from('properties')
            .select('id')
            .eq('account_id', accountId)
            .eq('reference_code', referenceCode)
            .single();

          if (matchedProperty) {
            validPropertyId = matchedProperty.id;
            console.log('Matched property by reference code:', validPropertyId);
          }
        }
      }
    }

    // Auto-detect "ref" field for property linking if not already linked
    if (!validPropertyId && formFields) {
      const refValue = formFields['ref'] || 
                       formFields['reference_code'] || 
                       formFields['codigo_referencia'] ||
                       formFields['codigo_imovel'] ||
                       formFields['código_de_referência'] ||
                       formFields['imovel_ref'];
      
      if (refValue) {
        console.log('Auto-detecting ref field for property linking:', refValue);
        const { data: matchedProperty } = await supabase
          .from('properties')
          .select('id')
          .eq('account_id', accountId)
          .eq('reference_code', refValue)
          .single();

        if (matchedProperty) {
          validPropertyId = matchedProperty.id;
          console.log('Auto-matched property by ref field:', validPropertyId);
        } else {
          console.log('No property found with reference code:', refValue);
        }
      }
    }

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
      property_id: validPropertyId,
      temperature: calculatedTemperature,
      meta_form_id: formId || null, // Store form_id for reference
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

    // Apply distribution rules
    try {
      const distributionResult = await supabase.functions.invoke('apply-distribution-rules', {
        body: {
          lead_id: lead.id,
          account_id: accountId,
        }
      });
      
      if (distributionResult.data?.success) {
        console.log(`✅ Lead distributed to ${distributionResult.data.broker_name} via rule: ${distributionResult.data.rule_applied}`);
      } else {
        console.log(`ℹ️ No distribution rule matched: ${distributionResult.data?.reason || 'unknown'}`);
      }
    } catch (distError) {
      console.error('Error applying distribution rules:', distError);
    }

    // Fetch property name for notification
    let propertyName: string | null = null;
    if (validPropertyId) {
      const { data: property } = await supabase
        .from('properties')
        .select('title')
        .eq('id', validPropertyId)
        .single();
      propertyName = property?.title || null;
    }

    // Send email notifications
    try {
      await supabase.functions.invoke('notify-new-lead', {
        body: {
          lead_id: lead.id,
          lead_name: lead.name,
          lead_phone: lead.phone,
          lead_email: lead.email,
          lead_temperature: calculatedTemperature,
          lead_origem: leadData.origem,
          property_name: propertyName,
          account_id: accountId,
        }
      });
      console.log('Notification function invoked successfully');
    } catch (notifyError) {
      console.error('Error invoking notify-new-lead:', notifyError);
      // Don't fail the webhook if notification fails
    }

    // Handle custom fields if provided (legacy support)
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

    // Save form_fields to lead_form_field_values table
    if (formFields && typeof formFields === 'object' && Object.keys(formFields).length > 0) {
      console.log('Saving form_fields to lead_form_field_values:', formFields);
      
      // Excluir apenas dados básicos do lead (manter ref para mostrar no detalhe do lead)
      const excludedFields = ['name', 'nome', 'full_name', 'email', 'e-mail', 'phone', 'phone_number', 'telefone', 'celular', 'whatsapp'];
      const formFieldValues = [];
      
      for (const [fieldName, fieldValue] of Object.entries(formFields)) {
        // Skip basic lead data fields
        if (excludedFields.includes(fieldName.toLowerCase())) continue;
        
        formFieldValues.push({
          lead_id: lead.id,
          field_name: fieldName,
          field_label: fieldName, // Use field name as label for now
          field_value: String(fieldValue),
        });
      }

      if (formFieldValues.length > 0) {
        const { error: formFieldsError } = await supabase
          .from('lead_form_field_values')
          .insert(formFieldValues);

        if (formFieldsError) {
          console.error('Error inserting form field values:', formFieldsError);
        } else {
          console.log(`Saved ${formFieldValues.length} form field values`);
        }
      }
    }

    // Send CAPI event if lead is hot
    if (calculatedTemperature === 'hot') {
      console.log('Lead is HOT, triggering CAPI event');
      try {
        await supabase.functions.invoke('send-meta-event', {
          body: {
            lead_id: lead.id,
            event_name: 'Lead',
            lead_type: 'qualified'
          }
        });
      } catch (capiError) {
        console.error('Error sending CAPI event:', capiError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        lead_id: lead.id,
        property_linked: validPropertyId !== null,
        temperature: calculatedTemperature,
        form_detected: !!formId,
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
