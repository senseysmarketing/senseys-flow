import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_APP_ID = Deno.env.get('META_APP_ID')!;
const META_APP_SECRET = Deno.env.get('META_APP_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Initialize Supabase client with service role
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

    // Action: Generate OAuth URL
    if (action === 'get-auth-url') {
      const redirectUri = `${SUPABASE_URL}/functions/v1/meta-oauth?action=callback`;
      const scopes = [
        'ads_management',
        'ads_read',
        'pages_manage_ads',
        'leads_retrieval',
        'pages_read_engagement',
        'pages_show_list',
        'business_management'
      ].join(',');

      const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?` +
        `client_id=${META_APP_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&response_type=code` +
        `&state=${user.id}`;

      console.log('Generated Meta OAuth URL');
      
      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Handle OAuth callback
    if (action === 'callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state'); // user_id
      const error = url.searchParams.get('error');

      if (error) {
        console.error('OAuth error:', error);
        return new Response(`
          <html>
            <body>
              <script>
                window.opener.postMessage({ type: 'META_AUTH_ERROR', error: '${error}' }, '*');
                window.close();
              </script>
            </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      if (!code) {
        return new Response('Missing code', { status: 400 });
      }

      const redirectUri = `${SUPABASE_URL}/functions/v1/meta-oauth?action=callback`;

      // Exchange code for short-lived token
      console.log('Exchanging code for access token...');
      const tokenResponse = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?` +
        `client_id=${META_APP_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&client_secret=${META_APP_SECRET}` +
        `&code=${code}`
      );

      const tokenData = await tokenResponse.json();
      console.log('Token response received');

      if (tokenData.error) {
        console.error('Token exchange error:', tokenData.error);
        return new Response(`
          <html>
            <body>
              <script>
                window.opener.postMessage({ type: 'META_AUTH_ERROR', error: '${tokenData.error.message}' }, '*');
                window.close();
              </script>
            </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // Exchange for long-lived token
      console.log('Exchanging for long-lived token...');
      const longLivedResponse = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?` +
        `grant_type=fb_exchange_token` +
        `&client_id=${META_APP_ID}` +
        `&client_secret=${META_APP_SECRET}` +
        `&fb_exchange_token=${tokenData.access_token}`
      );

      const longLivedData = await longLivedResponse.json();
      console.log('Long-lived token received');

      if (longLivedData.error) {
        console.error('Long-lived token error:', longLivedData.error);
        return new Response(`
          <html>
            <body>
              <script>
                window.opener.postMessage({ type: 'META_AUTH_ERROR', error: '${longLivedData.error.message}' }, '*');
                window.close();
              </script>
            </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // Get user info
      console.log('Fetching Meta user info...');
      const meResponse = await fetch(
        `https://graph.facebook.com/v19.0/me?access_token=${longLivedData.access_token}`
      );
      const meData = await meResponse.json();

      // Calculate expiration (long-lived tokens last ~60 days)
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (longLivedData.expires_in || 5184000));

      // Save token to database (upsert - only one record)
      const { error: upsertError } = await supabase
        .from('meta_agency_token')
        .upsert({
          id: '00000000-0000-0000-0000-000000000001', // Fixed ID for single record
          access_token: longLivedData.access_token,
          token_expires_at: expiresAt.toISOString(),
          user_id: meData.id,
          user_name: meData.name,
          scopes: ['ads_management', 'ads_read', 'pages_manage_ads', 'leads_retrieval', 'pages_read_engagement', 'pages_show_list', 'business_management'],
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        });

      if (upsertError) {
        console.error('Database upsert error:', upsertError);
        return new Response(`
          <html>
            <body>
              <script>
                window.opener.postMessage({ type: 'META_AUTH_ERROR', error: 'Erro ao salvar token' }, '*');
                window.close();
              </script>
            </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      console.log('Meta OAuth completed successfully for user:', meData.name);

      return new Response(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'META_AUTH_SUCCESS', userName: '${meData.name}' }, '*');
              window.close();
            </script>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Action: Get current token status
    if (action === 'status') {
      const { data: tokenData, error: tokenError } = await supabase
        .from('meta_agency_token')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .single();

      if (tokenError || !tokenData) {
        return new Response(JSON.stringify({ connected: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const isExpired = new Date(tokenData.token_expires_at) < new Date();

      return new Response(JSON.stringify({
        connected: !isExpired,
        userName: tokenData.user_name,
        expiresAt: tokenData.token_expires_at,
        isExpired,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Disconnect (delete token)
    if (action === 'disconnect') {
      await supabase
        .from('meta_agency_token')
        .delete()
        .eq('id', '00000000-0000-0000-0000-000000000001');

      console.log('Meta token disconnected');

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Meta OAuth error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
