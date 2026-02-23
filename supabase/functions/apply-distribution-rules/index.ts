import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DistributionRule {
  id: string;
  name: string;
  rule_type: string;
  conditions: Record<string, any>;
  target_broker_id: string | null;
  priority: number;
  is_active: boolean;
}

interface Lead {
  id: string;
  account_id: string;
  name: string;
  phone: string;
  email: string | null;
  origem: string | null;
  campanha: string | null;
  conjunto: string | null;
  anuncio: string | null;
  interesse: string | null;
  temperature: string | null;
  property_id: string | null;
  status_id: string | null;
  assigned_broker_id: string | null;
  created_at: string;
}

interface Broker {
  user_id: string;
  full_name: string | null;
  account_id: string;
}

// Normalize values for comparison
function normalizeForComparison(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if values match (partial match for flexibility)
function valuesMatch(leadValue: string | null | undefined, ruleValue: string | null | undefined): boolean {
  const normalizedLead = normalizeForComparison(leadValue);
  const normalizedRule = normalizeForComparison(ruleValue);
  
  if (!normalizedLead || !normalizedRule) return false;
  
  // Check for exact match or contains
  return normalizedLead === normalizedRule || 
         normalizedLead.includes(normalizedRule) || 
         normalizedRule.includes(normalizedLead);
}

// Evaluate time-based rules
function evaluateTimeRule(conditions: Record<string, any>): boolean {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;
  
  // Get day of week (0 = Sunday, 1 = Monday, etc.)
  const dayOfWeek = now.getDay();
  const dayNames = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  const currentDayName = dayNames[dayOfWeek];
  
  // Check day of week if specified
  if (conditions.days && Array.isArray(conditions.days) && conditions.days.length > 0) {
    const normalizedDays = conditions.days.map((d: string) => d.toLowerCase().substring(0, 3));
    if (!normalizedDays.includes(currentDayName)) {
      console.log(`Day ${currentDayName} not in allowed days: ${normalizedDays.join(', ')}`);
      return false;
    }
  }
  
  // Check time range if specified
  if (conditions.start_hour !== undefined && conditions.end_hour !== undefined) {
    const startTime = parseInt(conditions.start_hour) * 60 + (parseInt(conditions.start_minute) || 0);
    const endTime = parseInt(conditions.end_hour) * 60 + (parseInt(conditions.end_minute) || 0);
    
    if (currentTime < startTime || currentTime > endTime) {
      console.log(`Current time ${currentHour}:${currentMinute} not in range ${conditions.start_hour}:00-${conditions.end_hour}:00`);
      return false;
    }
  }
  
  return true;
}

// Evaluate region rules (based on property location)
async function evaluateRegionRule(
  supabase: any,
  conditions: Record<string, any>,
  lead: Lead
): Promise<boolean> {
  if (!lead.property_id) return false;
  
  // Get property location
  const { data: property } = await supabase
    .from('properties')
    .select('city, state, neighborhood')
    .eq('id', lead.property_id)
    .single();
  
  if (!property) return false;
  
  // Check each condition
  if (conditions.state && !valuesMatch(property.state, conditions.state)) {
    return false;
  }
  if (conditions.city && !valuesMatch(property.city, conditions.city)) {
    return false;
  }
  if (conditions.neighborhood && !valuesMatch(property.neighborhood, conditions.neighborhood)) {
    return false;
  }
  
  return true;
}

// Evaluate compound rules (AND/OR)
async function evaluateCompoundRule(
  supabase: any,
  conditions: Record<string, any>,
  lead: Lead
): Promise<boolean> {
  const operator = conditions.operator || 'AND';
  const subConditions = conditions.conditions || [];
  
  if (subConditions.length === 0) return false;
  
  for (const subCondition of subConditions) {
    const matches = await evaluateSingleCondition(supabase, subCondition, lead);
    
    if (operator === 'OR' && matches) {
      return true;
    }
    if (operator === 'AND' && !matches) {
      return false;
    }
  }
  
  return operator === 'AND';
}

// Evaluate a single condition (used by compound rules)
async function evaluateSingleCondition(
  supabase: any,
  condition: { type: string; value: any; field?: string },
  lead: Lead
): Promise<boolean> {
  switch (condition.type) {
    case 'temperature':
      return lead.temperature === condition.value;
    case 'origin':
      return valuesMatch(lead.origem, condition.value);
    case 'campaign':
      return valuesMatch(lead.campanha, condition.value);
    case 'adset':
      return valuesMatch(lead.conjunto, condition.value);
    case 'interest':
      return valuesMatch(lead.interesse, condition.value);
    default:
      return false;
  }
}

// Main rule evaluation function
async function evaluateRule(
  supabase: any,
  rule: DistributionRule,
  lead: Lead
): Promise<boolean> {
  const conditions = rule.conditions || {};
  
  console.log(`Evaluating rule "${rule.name}" (type: ${rule.rule_type})`);
  
  switch (rule.rule_type) {
    case 'round_robin':
      // Round robin always matches - it's a fallback distribution method
      return true;
    
    case 'origin':
      return valuesMatch(lead.origem, conditions.origem);
    
    case 'interest':
      return valuesMatch(lead.interesse, conditions.interesse);
    
    case 'property':
      return lead.property_id === conditions.property_id;
    
    case 'temperature':
      return lead.temperature === conditions.temperature;
    
    case 'campaign':
      // Check campaign name and/or ad set name
      const campaignMatch = conditions.campaign ? valuesMatch(lead.campanha, conditions.campaign) : true;
      const adsetMatch = conditions.conjunto ? valuesMatch(lead.conjunto, conditions.conjunto) : true;
      return campaignMatch && adsetMatch;
    
    case 'time_based':
      return evaluateTimeRule(conditions);
    
    case 'workload':
      // Workload rules always "match" but broker selection considers capacity
      return true;
    
    case 'region':
      return await evaluateRegionRule(supabase, conditions, lead);
    
    case 'compound':
      return await evaluateCompoundRule(supabase, conditions, lead);
    
    default:
      console.log(`Unknown rule type: ${rule.rule_type}`);
      return false;
  }
}

// Get active leads count for a broker
async function getActiveLeadsCount(
  supabase: any,
  brokerId: string,
  accountId: string,
  activeStatusIds?: string[]
): Promise<number> {
  let query = supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .eq('assigned_broker_id', brokerId);
  
  // If specific status IDs are provided, filter by them
  if (activeStatusIds && activeStatusIds.length > 0) {
    query = query.in('status_id', activeStatusIds);
  }
  
  const { count } = await query;
  return count || 0;
}

// Get next broker using round robin
async function getNextRoundRobinBroker(
  supabase: any,
  accountId: string,
  maxActiveLeads?: number,
  activeStatusIds?: string[]
): Promise<{ brokerId: string; brokerName: string } | null> {
  // Get round robin configuration
  let { data: rrConfig } = await supabase
    .from('broker_round_robin')
    .select('*')
    .eq('account_id', accountId)
    .single();
  
  // Get all brokers for the account
  const { data: brokers } = await supabase
    .from('profiles')
    .select('user_id, full_name')
    .eq('account_id', accountId);
  
  if (!brokers || brokers.length === 0) {
    console.log('No brokers found for account');
    return null;
  }
  
  // If no RR config exists, create one
  if (!rrConfig) {
    const brokerOrder = brokers.map((b: Broker) => b.user_id);
    const { data: newConfig } = await supabase
      .from('broker_round_robin')
      .insert({
        account_id: accountId,
        broker_order: brokerOrder,
        last_broker_index: -1, // Start at -1 so first distribution gets index 0
      })
      .select()
      .single();
    
    rrConfig = newConfig;
    console.log('Created new round robin config');
  }
  
  const brokerOrder = (rrConfig.broker_order as string[]) || brokers.map((b: Broker) => b.user_id);
  
  // Auto-sync: add missing brokers to round robin order
  const allBrokerIds = brokers.map((b: Broker) => b.user_id);
  const missingBrokers = allBrokerIds.filter(id => !brokerOrder.includes(id));
  // Also remove brokers that no longer exist
  const ghostBrokers = brokerOrder.filter(id => !allBrokerIds.includes(id));
  
  if (missingBrokers.length > 0 || ghostBrokers.length > 0) {
    // Remove ghosts
    for (const ghost of ghostBrokers) {
      const idx = brokerOrder.indexOf(ghost);
      if (idx !== -1) brokerOrder.splice(idx, 1);
    }
    // Add missing
    brokerOrder.push(...missingBrokers);
    
    await supabase
      .from('broker_round_robin')
      .update({ broker_order: brokerOrder })
      .eq('id', rrConfig.id);
    console.log(`Round robin synced: added ${missingBrokers.length}, removed ${ghostBrokers.length} brokers`);
  }

  const lastIndex = rrConfig.last_broker_index ?? -1;
  
  // Try each broker in order, starting from the next one
  for (let i = 0; i < brokerOrder.length; i++) {
    const index = (lastIndex + 1 + i) % brokerOrder.length;
    const brokerId = brokerOrder[index];
    
    // Check if broker still exists in profiles
    const broker = brokers.find((b: Broker) => b.user_id === brokerId);
    if (!broker) {
      console.log(`Broker ${brokerId} no longer exists, skipping`);
      continue;
    }
    
    // If workload limit is set, check capacity
    if (maxActiveLeads !== undefined) {
      const activeCount = await getActiveLeadsCount(supabase, brokerId, accountId, activeStatusIds);
      if (activeCount >= maxActiveLeads) {
        console.log(`Broker ${broker.full_name} has ${activeCount}/${maxActiveLeads} active leads, skipping`);
        continue;
      }
    }
    
    // Update the last broker index
    await supabase
      .from('broker_round_robin')
      .update({ 
        last_broker_index: index,
        updated_at: new Date().toISOString()
      })
      .eq('id', rrConfig.id);
    
    console.log(`Selected broker: ${broker.full_name} (index: ${index})`);
    return { brokerId: broker.user_id, brokerName: broker.full_name || 'Corretor' };
  }
  
  console.log('All brokers are at capacity or unavailable');
  return null;
}

// Resolve the target broker for a rule
async function resolveBroker(
  supabase: any,
  rule: DistributionRule,
  accountId: string
): Promise<{ brokerId: string; brokerName: string } | null> {
  // If rule has a specific target broker, use it
  if (rule.target_broker_id) {
    const { data: broker } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .eq('user_id', rule.target_broker_id)
      .single();
    
    if (broker) {
      return { brokerId: broker.user_id, brokerName: broker.full_name || 'Corretor' };
    }
    console.log(`Target broker ${rule.target_broker_id} not found`);
    return null;
  }
  
  // For workload rules, use round robin with capacity check
  if (rule.rule_type === 'workload') {
    const maxLeads = rule.conditions?.max_active_leads || 50;
    const activeStatusIds = rule.conditions?.active_status_ids as string[] | undefined;
    return await getNextRoundRobinBroker(supabase, accountId, maxLeads, activeStatusIds);
  }
  
  // For round robin rules, use round robin
  if (rule.rule_type === 'round_robin') {
    return await getNextRoundRobinBroker(supabase, accountId);
  }
  
  // For other rules without a target broker, use round robin as fallback
  return await getNextRoundRobinBroker(supabase, accountId);
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { lead_id, account_id } = await req.json();

    console.log('='.repeat(60));
    console.log(`Applying distribution rules for lead: ${lead_id}`);

    if (!lead_id || !account_id) {
      return new Response(
        JSON.stringify({ error: 'lead_id and account_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      console.error('Lead not found:', leadError);
      return new Response(
        JSON.stringify({ success: false, reason: 'lead_not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If lead is already assigned, skip
    if (lead.assigned_broker_id) {
      console.log(`Lead already assigned to ${lead.assigned_broker_id}`);
      return new Response(
        JSON.stringify({ success: false, reason: 'already_assigned' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch active distribution rules ordered by priority (highest first)
    const { data: rules, error: rulesError } = await supabase
      .from('distribution_rules')
      .select('*')
      .eq('account_id', account_id)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (rulesError) {
      console.error('Error fetching rules:', rulesError);
      return new Response(
        JSON.stringify({ success: false, reason: 'rules_fetch_error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rules || rules.length === 0) {
      console.log('No active distribution rules found');
      return new Response(
        JSON.stringify({ success: false, reason: 'no_rules' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${rules.length} active rules`);

    // Evaluate each rule in priority order
    for (const rule of rules) {
      const ruleData = {
        ...rule,
        conditions: rule.conditions as Record<string, any>
      } as DistributionRule;

      const matches = await evaluateRule(supabase, ruleData, lead);
      
      if (matches) {
        console.log(`✅ Rule "${rule.name}" matched!`);
        
        // Resolve broker
        const brokerResult = await resolveBroker(supabase, ruleData, account_id);
        
        if (brokerResult) {
          // Assign lead to broker
          const { error: updateError } = await supabase
            .from('leads')
            .update({ assigned_broker_id: brokerResult.brokerId })
            .eq('id', lead_id);

          if (updateError) {
            console.error('Error assigning lead:', updateError);
            continue; // Try next rule
          }

          // Log activity
          await supabase
            .from('lead_activities')
            .insert({
              lead_id: lead_id,
              account_id: account_id,
              activity_type: 'assigned',
              description: `Lead atribuído automaticamente a ${brokerResult.brokerName} via regra "${rule.name}"`,
              new_value: brokerResult.brokerId,
            });

          console.log(`✅ Lead assigned to ${brokerResult.brokerName}`);
          console.log('='.repeat(60));

          return new Response(
            JSON.stringify({
              success: true,
              broker_id: brokerResult.brokerId,
              broker_name: brokerResult.brokerName,
              rule_applied: rule.name,
              rule_type: rule.rule_type,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          console.log(`No available broker for rule "${rule.name}"`);
        }
      } else {
        console.log(`❌ Rule "${rule.name}" did not match`);
      }
    }

    console.log('No matching rules could assign the lead');
    console.log('='.repeat(60));

    return new Response(
      JSON.stringify({ success: false, reason: 'no_matching_rules' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error applying distribution rules:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
