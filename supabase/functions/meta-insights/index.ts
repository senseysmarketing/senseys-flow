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
      // Get user's profile to check their account
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('account_id')
        .eq('user_id', user.id)
        .single();

      // Check if user is super admin using RPC
      const { data: isSuperAdmin } = await supabase
        .rpc('is_super_admin', { _user_id: user.id });

      let targetAccountId: string;

      if (req.method === 'POST') {
        const body = await req.json();
        targetAccountId = body.account_id;

        // If not super admin, can only sync their own account
        if (!isSuperAdmin && targetAccountId !== userProfile?.account_id) {
          return new Response(JSON.stringify({ error: 'Not authorized to sync this account' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        // GET request - sync own account
        if (!userProfile?.account_id) {
          return new Response(JSON.stringify({ error: 'Profile not found' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        targetAccountId = userProfile.account_id;
      }

      const date_from = url.searchParams.get('date_from');
      const date_to = url.searchParams.get('date_to');

      // Get account's Meta config
      const { data: metaConfig } = await supabase
        .from('account_meta_config')
        .select('*')
        .eq('account_id', targetAccountId)
        .single();

      if (!metaConfig) {
        return new Response(JSON.stringify({ error: 'Account not configured with Meta', code: 'NOT_CONFIGURED' }), {
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

      console.log(`Syncing insights for account ${targetAccountId}, ad account ${adAccountId}, from ${startDate} to ${endDate}`);

      // Fetch insights from Meta (account level)
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
        return new Response(JSON.stringify({ error: insightsData.error.message, code: 'META_ERROR' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch campaign-level insights for detailed breakdown
      const campaignsResponse = await fetch(
        `https://graph.facebook.com/v19.0/${adAccountId}/insights?` +
        `fields=campaign_id,campaign_name,spend,impressions,clicks,reach,actions&` +
        `time_range={"since":"${startDate}","until":"${endDate}"}&` +
        `level=campaign&` +
        `access_token=${accessToken}`
      );

      const campaignsData = await campaignsResponse.json();
      console.log(`Fetched ${campaignsData.data?.length || 0} campaign insights`);

      // Process campaign data into a map by date
      const campaignsByDate = new Map<string, any[]>();
      for (const campaign of campaignsData.data || []) {
        const dateKey = campaign.date_start;
        const leadsAction = campaign.actions?.find((a: any) => a.action_type === 'lead');
        const leadsCount = leadsAction?.value ? parseInt(leadsAction.value) : 0;
        
        const campaignInfo = {
          id: campaign.campaign_id,
          name: campaign.campaign_name,
          spend: parseFloat(campaign.spend || '0'),
          impressions: parseInt(campaign.impressions || '0'),
          clicks: parseInt(campaign.clicks || '0'),
          leads: leadsCount,
        };

        if (!campaignsByDate.has(dateKey)) {
          campaignsByDate.set(dateKey, []);
        }
        campaignsByDate.get(dateKey)!.push(campaignInfo);
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
          account_id: targetAccountId,
          date: day.date_start,
          spend,
          impressions: parseInt(day.impressions || '0'),
          clicks: parseInt(day.clicks || '0'),
          leads_count: leadsCount,
          reach: parseInt(day.reach || '0'),
          cpm: parseFloat(day.cpm || '0'),
          cpc: parseFloat(day.cpc || '0'),
          cpl,
          campaign_data: campaignsByDate.get(day.date_start) || [],
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
        .eq('account_id', targetAccountId);

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

      // Get account's Meta config for status info
      const { data: metaConfig } = await supabase
        .from('account_meta_config')
        .select('ad_account_name, last_sync_at, is_active')
        .eq('account_id', profile.account_id)
        .single();

      // Read dates from body (POST via invoke) or URL params (GET)
      let dateFrom: string | null = null;
      let dateTo: string | null = null;
      
      if (req.method === 'POST') {
        try {
          const body = await req.json();
          dateFrom = body.date_from || null;
          dateTo = body.date_to || null;
        } catch {
          // Body already consumed or empty, fall back to URL params
        }
      }
      
      // Fall back to URL params if not in body
      if (!dateFrom) dateFrom = url.searchParams.get('date_from');
      if (!dateTo) dateTo = url.searchParams.get('date_to');

      console.log(`Fetching insights for account ${profile.account_id}, from ${dateFrom} to ${dateTo}`);

      let query = supabase
        .from('meta_ad_insights')
        .select('*')
        .eq('account_id', profile.account_id)
        .order('date', { ascending: true });

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

      // Aggregate campaign data
      const campaignMap = new Map<string, { spend: number; leads: number; impressions: number; clicks: number }>();
      for (const day of insights || []) {
        const campaigns = (day.campaign_data as any[]) || [];
        for (const campaign of campaigns) {
          const existing = campaignMap.get(campaign.name) || { spend: 0, leads: 0, impressions: 0, clicks: 0 };
          campaignMap.set(campaign.name, {
            spend: existing.spend + (campaign.spend || 0),
            leads: existing.leads + (campaign.leads || 0),
            impressions: existing.impressions + (campaign.impressions || 0),
            clicks: existing.clicks + (campaign.clicks || 0),
          });
        }
      }

      const campaignData = Array.from(campaignMap.entries()).map(([name, data]) => ({
        name,
        ...data,
        cpl: data.leads > 0 ? data.spend / data.leads : 0,
      })).sort((a, b) => b.leads - a.leads);

      return new Response(JSON.stringify({ 
        insights,
        totals: {
          ...totals,
          cpm: avgCpm,
          cpc: avgCpc,
          cpl: avgCpl,
          ctr,
        },
        campaignData,
        config: metaConfig ? {
          adAccountName: metaConfig.ad_account_name,
          lastSyncAt: metaConfig.last_sync_at,
          isActive: metaConfig.is_active,
        } : null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sync all accounts (for super admin or cron job)
    if (action === 'sync-all') {
      const { data: isSuperAdmin } = await supabase
        .rpc('is_super_admin', { _user_id: user.id });

      if (!isSuperAdmin) {
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
