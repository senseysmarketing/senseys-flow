import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SHA256 hash function
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Normalize phone number for hashing (remove non-digits, add country code if missing)
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  // Add Brazil country code if not present
  if (cleaned.length === 11 || cleaned.length === 10) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

// Normalize email for hashing (lowercase, trim)
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

serve(async (req) => {
  console.log('='.repeat(60));
  console.log(`[${new Date().toISOString()}] send-meta-event called`);
  console.log(`Method: ${req.method}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead_id, event_name, custom_data = {} } = await req.json();
    
    console.log(`Processing event: ${event_name} for lead: ${lead_id}`);
    console.log(`Custom data:`, JSON.stringify(custom_data, null, 2));

    if (!lead_id || !event_name) {
      console.error('Missing required parameters');
      return new Response(
        JSON.stringify({ error: 'Missing lead_id or event_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch lead data with account info
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*, profiles:assigned_broker_id(full_name)')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      console.error('Lead not found:', leadError);
      return new Response(
        JSON.stringify({ error: 'Lead not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Lead found: ${lead.name}, account: ${lead.account_id}`);

    // Get Meta config for this account
    const { data: metaConfig, error: configError } = await supabase
      .from('account_meta_config')
      .select('pixel_id, ad_account_id')
      .eq('account_id', lead.account_id)
      .eq('is_active', true)
      .single();

    if (configError || !metaConfig) {
      console.error('No active Meta config for account:', configError);
      return new Response(
        JSON.stringify({ error: 'No Meta config for this account', skipped: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!metaConfig.pixel_id) {
      console.log('No pixel_id configured, skipping CAPI event');
      return new Response(
        JSON.stringify({ message: 'No pixel configured', skipped: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Pixel ID: ${metaConfig.pixel_id}`);

    // Get Meta access token
    const { data: tokenData, error: tokenError } = await supabase
      .from('meta_agency_token')
      .select('access_token')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single();

    if (tokenError || !tokenData?.access_token) {
      console.error('No Meta token found:', tokenError);
      return new Response(
        JSON.stringify({ error: 'No Meta token configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate event_id - use meta_lead_id for structural linking with Meta Lead Forms
    const timestamp = Math.floor(Date.now() / 1000);
    const eventId = lead.meta_lead_id 
      ? lead.meta_lead_id 
      : `${lead_id}_${event_name}_${timestamp}`;
    console.log(`Event ID: ${eventId} (${lead.meta_lead_id ? 'meta_lead_id - advanced matching' : 'fallback - internal ID'})`);

    // Build user_data with hashed values
    const userData: Record<string, any> = {};
    
    // Add lead_id from Meta if available (crucial for matching)
    if (lead.meta_lead_id) {
      userData.lead_id = lead.meta_lead_id;
      console.log(`Including meta_lead_id for matching: ${lead.meta_lead_id}`);
    }

    // Hash and add email if available
    if (lead.email) {
      const normalizedEmail = normalizeEmail(lead.email);
      const hashedEmail = await sha256(normalizedEmail);
      userData.em = [hashedEmail];
      console.log(`Email hashed: ${normalizedEmail} -> ${hashedEmail.substring(0, 10)}...`);
    }

    // Hash and add phone if available
    if (lead.phone) {
      const normalizedPhone = normalizePhone(lead.phone);
      const hashedPhone = await sha256(normalizedPhone);
      userData.ph = [hashedPhone];
      console.log(`Phone hashed: ${normalizedPhone} -> ${hashedPhone.substring(0, 10)}...`);
    }

    // Build the event payload
    const eventPayload = {
      data: [{
        event_name: event_name,
        event_time: timestamp,
        event_id: eventId,
        action_source: 'system_generated',
        user_data: userData,
        custom_data: {
          lead_event_source: 'Senseys CRM',
          event_source: 'crm',
          content_name: lead.interesse || undefined,
          content_category: lead.origem || undefined,
          ...custom_data,
        },
      }],
    };

    console.log('Sending event to Meta CAPI:', JSON.stringify(eventPayload, null, 2));

    // Send to Meta Conversions API
    const capiResponse = await fetch(
      `https://graph.facebook.com/v19.0/${metaConfig.pixel_id}/events?access_token=${tokenData.access_token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventPayload),
      }
    );

    const capiResult = await capiResponse.json();
    console.log(`Meta CAPI response (${capiResponse.status}):`, JSON.stringify(capiResult, null, 2));

    // Log the event
    const { error: logError } = await supabase
      .from('meta_capi_events_log')
      .insert({
        lead_id: lead_id,
        account_id: lead.account_id,
        event_name: event_name,
        event_id: eventId,
        pixel_id: metaConfig.pixel_id,
        status_code: capiResponse.status,
        response_body: capiResult,
        error_message: capiResult.error?.message || null,
      });

    if (logError) {
      console.error('Error logging CAPI event:', logError);
    } else {
      console.log('✅ Event logged successfully');
    }

    if (capiResult.error) {
      console.error('Meta CAPI error:', capiResult.error);
      return new Response(
        JSON.stringify({ 
          error: capiResult.error.message,
          fbtrace_id: capiResult.error.fbtrace_id,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('='.repeat(60));
    console.log(`✅ Event ${event_name} sent successfully for lead ${lead_id}`);
    console.log('='.repeat(60));

    return new Response(
      JSON.stringify({ 
        success: true,
        events_received: capiResult.events_received,
        fbtrace_id: capiResult.fbtrace_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-meta-event:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
