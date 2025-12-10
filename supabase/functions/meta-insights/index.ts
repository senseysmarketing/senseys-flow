import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

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

    // Get Meta token
    const { data: tokenData } = await supabase
      .from('meta_agency_token')
      .select('access_token')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single();

    if (!tokenData?.access_token) {
      return new Response(JSON.stringify({ error: 'Meta not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = tokenData.access_token;

    // Sync insights for a specific account
    if (action === 'sync') {
      // Check if user is super admin
      const { data: superAdmin } = await supabase
        .from('super_admins')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!superAdmin) {
        return new Response(JSON.stringify({ error: 'Not authorized - super admin only' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = await req.json();
      const { account_id, date_from, date_to } = body;

      // Get account's Meta config
      const { data: metaConfig } = await supabase
        .from('account_meta_config')
        .select('*')
        .eq('account_id', account_id)
        .single();

      if (!metaConfig) {
        return new Response(JSON.stringify({ error: 'Account not configured with Meta' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const adAccountId = metaConfig.ad_account_id.startsWith('act_') 
        ? metaConfig.ad_account_id 
        : `act_${metaConfig.ad_account_id}`;

      // Calculate date range (default: last 30 days)
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const startDate = date_from || thirtyDaysAgo.toISOString().split('T')[0];
      const endDate = date_to || today.toISOString().split('T')[0];

      console.log(`Syncing insights for account ${account_id}, ad account ${adAccountId}, from ${startDate} to ${endDate}`);

      // Fetch insights from Meta
      const insightsResponse = await fetch(
        `https://graph.facebook.com/v19.0/${adAccountId}/insights?` +
        `fields=spend,impressions,clicks,reach,cpm,cpc,actions&` +
        `time_range={"since":"${startDate}","until":"${endDate}"}&` +
        `time_increment=1&` +
        `access_token=${accessToken}`
      );

      const insightsData = await insightsResponse.json();

      if (insightsData.error) {
        console.error('Error fetching insights:', insightsData.error);
        return new Response(JSON.stringify({ error: insightsData.error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Process and save each day's data
      const savedInsights = [];
      for (const day of insightsData.data || []) {
        // Count leads from actions
        const leadsAction = day.actions?.find((a: any) => a.action_type === 'lead');
        const leadsCount = leadsAction?.value ? parseInt(leadsAction.value) : 0;

        const spend = parseFloat(day.spend || '0');
        const cpl = leadsCount > 0 ? spend / leadsCount : 0;

        const insightData = {
          account_id,
          date: day.date_start,
          spend,
          impressions: parseInt(day.impressions || '0'),
          clicks: parseInt(day.clicks || '0'),
          leads_count: leadsCount,
          reach: parseInt(day.reach || '0'),
          cpm: parseFloat(day.cpm || '0'),
          cpc: parseFloat(day.cpc || '0'),
          cpl,
        };

        const { error: upsertError } = await supabase
          .from('meta_ad_insights')
          .upsert(insightData, {
            onConflict: 'account_id,date'
          });

        if (upsertError) {
          console.error('Error saving insight:', upsertError);
        } else {
          savedInsights.push(insightData);
        }
      }

      // Update last sync time
      await supabase
        .from('account_meta_config')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('account_id', account_id);

      console.log(`Saved ${savedInsights.length} days of insights`);

      return new Response(JSON.stringify({ 
        success: true, 
        synced: savedInsights.length,
        insights: savedInsights
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get insights for current user's account
    if (action === 'get' || !action) {
      // Get user's account
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        return new Response(JSON.stringify({ error: 'Profile not found' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const dateFrom = url.searchParams.get('date_from');
      const dateTo = url.searchParams.get('date_to');

      let query = supabase
        .from('meta_ad_insights')
        .select('*')
        .eq('account_id', profile.account_id)
        .order('date', { ascending: false });

      if (dateFrom) {
        query = query.gte('date', dateFrom);
      }
      if (dateTo) {
        query = query.lte('date', dateTo);
      }

      const { data: insights, error } = await query.limit(90);

      if (error) {
        console.error('Error fetching insights:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Calculate totals
      const totals = insights?.reduce((acc, day) => ({
        spend: acc.spend + (day.spend || 0),
        impressions: acc.impressions + (day.impressions || 0),
        clicks: acc.clicks + (day.clicks || 0),
        leads_count: acc.leads_count + (day.leads_count || 0),
        reach: acc.reach + (day.reach || 0),
      }), {
        spend: 0,
        impressions: 0,
        clicks: 0,
        leads_count: 0,
        reach: 0,
      });

      // Calculate averages
      const avgCpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
      const avgCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
      const avgCpl = totals.leads_count > 0 ? totals.spend / totals.leads_count : 0;
      const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

      return new Response(JSON.stringify({ 
        insights,
        totals: {
          ...totals,
          cpm: avgCpm,
          cpc: avgCpc,
          cpl: avgCpl,
          ctr,
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sync all accounts (for super admin or cron job)
    if (action === 'sync-all') {
      const { data: superAdmin } = await supabase
        .from('super_admins')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!superAdmin) {
        return new Response(JSON.stringify({ error: 'Not authorized - super admin only' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get all active Meta configs
      const { data: configs } = await supabase
        .from('account_meta_config')
        .select('account_id')
        .eq('is_active', true);

      const results = [];
      for (const config of configs || []) {
        try {
          // Recursively call sync for each account
          const syncResponse = await fetch(
            `${SUPABASE_URL}/functions/v1/meta-insights?action=sync`,
            {
              method: 'POST',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ account_id: config.account_id }),
            }
          );
          const syncResult = await syncResponse.json();
          results.push({ account_id: config.account_id, ...syncResult });
        } catch (e) {
          results.push({ account_id: config.account_id, error: e.message });
        }
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Meta insights error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
