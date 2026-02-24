import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create client with user's token to verify identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the current user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create admin client for cross-account queries
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is super admin using the database function (which includes agency account members)
    const { data: isSuperAdmin, error: superAdminError } = await adminClient
      .rpc('is_super_admin', { _user_id: user.id });

    if (superAdminError) {
      console.error('Super admin check error:', superAdminError);
      return new Response(JSON.stringify({ error: 'Error checking admin status' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!isSuperAdmin) {
      console.error('User is not a super admin:', user.email);
      return new Response(JSON.stringify({ error: 'Not a super admin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Super admin verified:', user.email);

    // Fetch all accounts with aggregated data
    const { data: accounts, error: accountsError } = await adminClient
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      throw accountsError;
    }

    // Get stats for each account
    const accountsWithStats = await Promise.all(
      (accounts || []).map(async (account) => {
        // Get lead count
        const { count: leadCount } = await adminClient
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('account_id', account.id);

        // Get WhatsApp session status
        const { data: whatsappSession } = await adminClient
          .from('whatsapp_sessions')
          .select('status, phone_number')
          .eq('account_id', account.id)
          .single();

        // Get last sent message
        const { data: lastSentMessage } = await adminClient
          .from('whatsapp_message_queue')
          .select('sent_at')
          .eq('account_id', account.id)
          .eq('status', 'sent')
          .order('sent_at', { ascending: false })
          .limit(1)
          .single();

        // Get last lead
        const { data: lastLead } = await adminClient
          .from('leads')
          .select('created_at')
          .eq('account_id', account.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Get last activity
        const { data: lastActivity } = await adminClient
          .from('lead_activities')
          .select('created_at')
          .eq('account_id', account.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Determine status based on activity
        const lastActivityDate = lastActivity?.created_at || lastLead?.created_at || account.created_at;
        const daysSinceActivity = Math.floor(
          (Date.now() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        let status: 'active' | 'inactive' | 'dormant' = 'active';
        if (daysSinceActivity > 30) status = 'dormant';
        else if (daysSinceActivity > 7) status = 'inactive';

        return {
          ...account,
          lead_count: leadCount || 0,
          whatsapp_connected: whatsappSession?.status === 'connected',
          whatsapp_phone: whatsappSession?.phone_number || null,
          last_message_sent_at: lastSentMessage?.sent_at || null,
          last_lead_at: lastLead?.created_at || null,
          last_activity_at: lastActivity?.created_at || lastLead?.created_at || null,
          days_since_activity: daysSinceActivity,
          status
        };
      })
    );

    // Calculate totals
    const totals = {
      total_accounts: accountsWithStats.length,
      total_leads: accountsWithStats.reduce((sum, a) => sum + a.lead_count, 0),
      whatsapp_connected_count: accountsWithStats.filter(a => a.whatsapp_connected).length,
      active_accounts: accountsWithStats.filter(a => a.status === 'active').length,
      inactive_accounts: accountsWithStats.filter(a => a.status === 'inactive').length,
      dormant_accounts: accountsWithStats.filter(a => a.status === 'dormant').length,
    };

    console.log('Returning data for', accountsWithStats.length, 'accounts');

    return new Response(JSON.stringify({
      accounts: accountsWithStats,
      totals
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in agency-admin-data:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
