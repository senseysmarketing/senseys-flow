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

    // Verify user is super admin
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

    // Check if user is super admin (uses DB function that includes agency account check)
    const { data: isSuperAdmin, error: saError } = await supabase
      .rpc('is_super_admin', { _user_id: user.id });

    if (saError || !isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Not authorized - agency access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Meta token
    const { data: tokenData, error: tokenError } = await supabase
      .from('meta_agency_token')
      .select('access_token')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single();

    if (tokenError || !tokenData?.access_token) {
      return new Response(JSON.stringify({ 
        error: 'Meta not connected',
        adAccounts: [],
        pages: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = tokenData.access_token;
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Get Ad Accounts
    if (action === 'ad-accounts' || !action) {
      console.log('Fetching ad accounts...');
      
      // First get the user's business accounts
      const meResponse = await fetch(
        `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status,currency,business{id,name}&limit=100&access_token=${accessToken}`
      );
      const meData = await meResponse.json();

      if (meData.error) {
        console.error('Error fetching ad accounts:', meData.error);
        return new Response(JSON.stringify({ error: meData.error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const adAccounts = (meData.data || []).map((acc: any) => ({
        id: acc.id.replace('act_', ''),
        fullId: acc.id,
        name: acc.name,
        status: acc.account_status,
        currency: acc.currency,
        business: acc.business?.name || 'Pessoal',
      }));

      console.log(`Found ${adAccounts.length} ad accounts`);

      return new Response(JSON.stringify({ adAccounts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Pages
    if (action === 'pages') {
      console.log('Fetching pages...');
      
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,category&limit=100&access_token=${accessToken}`
      );
      const pagesData = await pagesResponse.json();

      if (pagesData.error) {
        console.error('Error fetching pages:', pagesData.error);
        return new Response(JSON.stringify({ error: pagesData.error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const pages = (pagesData.data || []).map((page: any) => ({
        id: page.id,
        name: page.name,
        category: page.category,
      }));

      console.log(`Found ${pages.length} pages`);

      return new Response(JSON.stringify({ pages }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Forms for a specific page
    if (action === 'forms') {
      const pageId = url.searchParams.get('page_id');
      if (!pageId || pageId === '__none__') {
        return new Response(JSON.stringify({ forms: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Fetching forms for page ${pageId}...`);

      // We need the page access token
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token&limit=100&access_token=${accessToken}`
      );
      const pagesData = await pagesResponse.json();
      
      console.log(`Found ${pagesData.data?.length || 0} pages, looking for page ID: ${pageId}`);
      
      if (pagesData.error) {
        console.error('Error fetching pages for forms:', pagesData.error);
        return new Response(JSON.stringify({ error: pagesData.error.message, forms: [] }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Log available pages for debugging
      const availablePages = pagesData.data?.map((p: any) => ({ id: p.id, name: p.name })) || [];
      console.log('Available pages:', JSON.stringify(availablePages));
      
      const page = pagesData.data?.find((p: any) => p.id === pageId);
      const pageToken = page?.access_token;

      if (!pageToken) {
        console.error(`Page ${pageId} not found in available pages or no access token`);
        // Return empty forms instead of error - page might not have leadgen permission
        return new Response(JSON.stringify({ 
          forms: [],
          message: 'Página não encontrada ou sem permissão de acesso a formulários'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Found page token for ${page.name}, fetching forms...`);

      const formsResponse = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/leadgen_forms?fields=id,name,status&access_token=${pageToken}`
      );
      const formsData = await formsResponse.json();

      if (formsData.error) {
        console.error('Error fetching forms:', formsData.error);
        // Return empty forms with message instead of error
        return new Response(JSON.stringify({ 
          forms: [],
          message: formsData.error.message
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const forms = (formsData.data || []).map((form: any) => ({
        id: form.id,
        name: form.name,
        status: form.status,
      }));

      console.log(`Found ${forms.length} forms for page ${pageId}`);

      return new Response(JSON.stringify({ forms }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Save account configuration
    if (action === 'save-config') {
      const body = await req.json();
      const { account_id, ad_account_id, ad_account_name, page_id, page_name, form_id, form_name, pixel_id, is_active } = body;

      if (!account_id || !ad_account_id) {
        return new Response(JSON.stringify({ error: 'account_id and ad_account_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Saving config for account ${account_id}`);

      const { data, error } = await supabase
        .from('account_meta_config')
        .upsert({
          account_id,
          ad_account_id,
          ad_account_name,
          page_id,
          page_name,
          form_id,
          form_name,
          pixel_id,
          is_active: is_active !== false,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'account_id'
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving config:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Subscribe page to webhook if page_id is provided
      if (page_id) {
        try {
          // Get page token
          const pagesResponse = await fetch(
            `https://graph.facebook.com/v19.0/me/accounts?fields=id,access_token&access_token=${accessToken}`
          );
          const pagesData = await pagesResponse.json();
          const pageToken = pagesData.data?.find((p: any) => p.id === page_id)?.access_token;

          if (pageToken) {
            // Subscribe page to leadgen
            const subscribeResponse = await fetch(
              `https://graph.facebook.com/v19.0/${page_id}/subscribed_apps?subscribed_fields=leadgen&access_token=${pageToken}`,
              { method: 'POST' }
            );
            const subscribeData = await subscribeResponse.json();
            console.log('Page subscription result:', subscribeData);
          }
        } catch (e) {
          console.error('Error subscribing page:', e);
        }
      }

      return new Response(JSON.stringify({ success: true, config: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all configurations
    if (action === 'get-configs') {
      const { data: configs, error } = await supabase
        .from('account_meta_config')
        .select(`
          *,
          accounts:account_id (
            id,
            name,
            company_name
          )
        `);

      if (error) {
        console.error('Error fetching configs:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ configs }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete configuration
    if (action === 'delete-config') {
      const body = await req.json();
      const { account_id } = body;

      if (!account_id) {
        return new Response(JSON.stringify({ error: 'account_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await supabase
        .from('account_meta_config')
        .delete()
        .eq('account_id', account_id);

      if (error) {
        console.error('Error deleting config:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Meta accounts error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
