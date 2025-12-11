import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { form_config_id } = await req.json();

    if (!form_config_id) {
      return new Response(
        JSON.stringify({ error: 'form_config_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting temperature recalculation for form_config_id: ${form_config_id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch form configuration
    const { data: formConfig, error: configError } = await supabase
      .from('meta_form_configs')
      .select('*')
      .eq('id', form_config_id)
      .single();

    if (configError || !formConfig) {
      console.error('Form config not found:', configError);
      return new Response(
        JSON.stringify({ error: 'Form configuration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Form config found: ${formConfig.form_name}, thresholds: hot=${formConfig.hot_threshold}, warm=${formConfig.warm_threshold}`);

    // 2. Fetch scoring rules
    const { data: scoringRules, error: rulesError } = await supabase
      .from('meta_form_scoring_rules')
      .select('*')
      .eq('form_config_id', form_config_id);

    if (rulesError) {
      console.error('Error fetching scoring rules:', rulesError);
      return new Response(
        JSON.stringify({ error: 'Error fetching scoring rules' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${scoringRules?.length || 0} scoring rules`);

    // 3. Fetch all leads with this form_id
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, temperature, account_id')
      .eq('meta_form_id', formConfig.form_id)
      .eq('account_id', formConfig.account_id);

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
      return new Response(
        JSON.stringify({ error: 'Error fetching leads' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${leads?.length || 0} leads to process`);

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No leads to update',
          stats: { total: 0, updated: 0, unchanged: 0 }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Get custom fields for this account
    const { data: customFields, error: fieldsError } = await supabase
      .from('custom_fields')
      .select('id, field_key, name')
      .eq('account_id', formConfig.account_id);

    if (fieldsError) {
      console.error('Error fetching custom fields:', fieldsError);
    }

    // Build scoring map: question_name -> answer_value -> score
    const scoringMap = new Map<string, Map<string, number>>();
    for (const rule of scoringRules || []) {
      if (!scoringMap.has(rule.question_name)) {
        scoringMap.set(rule.question_name, new Map());
      }
      scoringMap.get(rule.question_name)!.set(rule.answer_value.toLowerCase(), rule.score);
    }

    let updated = 0;
    let unchanged = 0;

    // 5. Process each lead
    for (const lead of leads) {
      // Get custom field values for this lead
      const { data: fieldValues, error: valuesError } = await supabase
        .from('lead_custom_field_values')
        .select('custom_field_id, value')
        .eq('lead_id', lead.id);

      if (valuesError) {
        console.error(`Error fetching field values for lead ${lead.id}:`, valuesError);
        continue;
      }

      // Calculate score
      let totalScore = 0;
      for (const fieldValue of fieldValues || []) {
        // Find the custom field to get the field_key/name
        const customField = customFields?.find(cf => cf.id === fieldValue.custom_field_id);
        if (!customField || !fieldValue.value) continue;

        // Check both field_key and name for matching
        const questionScores = scoringMap.get(customField.field_key) || scoringMap.get(customField.name);
        if (questionScores) {
          const score = questionScores.get(fieldValue.value.toLowerCase());
          if (score !== undefined) {
            totalScore += score;
            console.log(`Lead ${lead.id}: ${customField.name}="${fieldValue.value}" -> +${score}`);
          }
        }
      }

      // Determine temperature
      let newTemperature: string;
      if (totalScore >= formConfig.hot_threshold) {
        newTemperature = 'hot';
      } else if (totalScore >= formConfig.warm_threshold) {
        newTemperature = 'warm';
      } else {
        newTemperature = 'cold';
      }

      console.log(`Lead ${lead.id}: totalScore=${totalScore}, currentTemp=${lead.temperature}, newTemp=${newTemperature}`);

      // Update if changed
      if (lead.temperature !== newTemperature) {
        const { error: updateError } = await supabase
          .from('leads')
          .update({ temperature: newTemperature })
          .eq('id', lead.id);

        if (updateError) {
          console.error(`Error updating lead ${lead.id}:`, updateError);
        } else {
          updated++;
          console.log(`Updated lead ${lead.id}: ${lead.temperature} -> ${newTemperature}`);
        }
      } else {
        unchanged++;
      }
    }

    console.log(`Recalculation complete. Total: ${leads.length}, Updated: ${updated}, Unchanged: ${unchanged}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Recalculation complete`,
        stats: {
          total: leads.length,
          updated,
          unchanged
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in recalculate-lead-temperatures:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
