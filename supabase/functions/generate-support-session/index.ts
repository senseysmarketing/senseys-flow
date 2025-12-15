import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Production URL for redirect - hardcoded to ensure consistency
const PRODUCTION_URL = 'https://e56959d6-20bb-4156-91a4-a054b64c66db.lovableproject.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Create client with user's token to verify super admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is super admin
    const { data: isSuperAdmin } = await userClient.rpc('is_super_admin', { _user_id: user.id })
    if (!isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: 'Access denied - not a super admin' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body
    const { account_id, redirect_to } = await req.json()

    if (!account_id) {
      return new Response(
        JSON.stringify({ error: 'account_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create service role client for admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Find a user (preferably owner) in the target account
    const { data: profiles, error: profileError } = await adminClient
      .from('profiles')
      .select('user_id')
      .eq('account_id', account_id)
      .limit(1)

    if (profileError || !profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No users found in this account' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const targetUserId = profiles[0].user_id

    // Get user email
    const { data: targetUser, error: targetUserError } = await adminClient.auth.admin.getUserById(targetUserId)
    if (targetUserError || !targetUser.user) {
      return new Response(
        JSON.stringify({ error: 'Failed to get user data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use production URL as the redirect destination
    const finalRedirectTo = redirect_to || `${PRODUCTION_URL}/dashboard`
    
    console.log('=== Support Session Generation ===')
    console.log('Account ID:', account_id)
    console.log('Target user email:', targetUser.user.email)
    console.log('Requested redirect_to:', redirect_to)
    console.log('Final redirect_to:', finalRedirectTo)

    // Generate magic link for the target user
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.user.email!,
      options: {
        redirectTo: finalRedirectTo
      }
    })

    if (linkError) {
      console.error('Error generating magic link:', linkError)
      return new Response(
        JSON.stringify({ error: linkError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Generated action_link:', linkData.properties.action_link)
    console.log('Hashed token available:', !!linkData.properties.hashed_token)
    console.log('=== End Support Session ===')

    return new Response(
      JSON.stringify({ 
        success: true, 
        url: linkData.properties.action_link
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
