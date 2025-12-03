import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
    const { account_id, confirmation } = await req.json()

    if (!account_id) {
      return new Response(
        JSON.stringify({ error: 'account_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (confirmation !== 'EXCLUIR') {
      return new Response(
        JSON.stringify({ error: 'Confirmation text must be "EXCLUIR"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create service role client for admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Get all users in this account
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('user_id')
      .eq('account_id', account_id)

    const userIds = profiles?.map(p => p.user_id) || []

    console.log(`Deleting account ${account_id} with ${userIds.length} users`)

    // Delete in correct order to avoid FK violations
    // 1. Lead activities
    await adminClient.from('lead_activities').delete().eq('account_id', account_id)
    console.log('Deleted lead_activities')

    // 2. Lead custom field values (via leads)
    const { data: leads } = await adminClient.from('leads').select('id').eq('account_id', account_id)
    if (leads && leads.length > 0) {
      const leadIds = leads.map(l => l.id)
      await adminClient.from('lead_custom_field_values').delete().in('lead_id', leadIds)
      console.log('Deleted lead_custom_field_values')
    }

    // 3. Leads
    await adminClient.from('leads').delete().eq('account_id', account_id)
    console.log('Deleted leads')

    // 4. Events
    await adminClient.from('events').delete().eq('account_id', account_id)
    console.log('Deleted events')

    // 5. Properties
    await adminClient.from('properties').delete().eq('account_id', account_id)
    console.log('Deleted properties')

    // 6. Custom fields
    await adminClient.from('custom_fields').delete().eq('account_id', account_id)
    console.log('Deleted custom_fields')

    // 7. WhatsApp templates
    await adminClient.from('whatsapp_templates').delete().eq('account_id', account_id)
    console.log('Deleted whatsapp_templates')

    // 8. Distribution rules
    await adminClient.from('distribution_rules').delete().eq('account_id', account_id)
    console.log('Deleted distribution_rules')

    // 9. Broker round robin
    await adminClient.from('broker_round_robin').delete().eq('account_id', account_id)
    console.log('Deleted broker_round_robin')

    // 10. Team invites
    await adminClient.from('team_invites').delete().eq('account_id', account_id)
    console.log('Deleted team_invites')

    // 11. Lead status
    await adminClient.from('lead_status').delete().eq('account_id', account_id)
    console.log('Deleted lead_status')

    // 12. Get roles for this account
    const { data: roles } = await adminClient.from('roles').select('id').eq('account_id', account_id)
    const roleIds = roles?.map(r => r.id) || []

    // 13. Role permissions
    if (roleIds.length > 0) {
      await adminClient.from('role_permissions').delete().in('role_id', roleIds)
      console.log('Deleted role_permissions')
    }

    // 14. User roles
    if (userIds.length > 0) {
      await adminClient.from('user_roles').delete().in('user_id', userIds)
      console.log('Deleted user_roles')
    }

    // 15. Roles
    await adminClient.from('roles').delete().eq('account_id', account_id)
    console.log('Deleted roles')

    // 16. Profiles
    await adminClient.from('profiles').delete().eq('account_id', account_id)
    console.log('Deleted profiles')

    // 17. Delete auth users
    for (const userId of userIds) {
      const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId)
      if (deleteUserError) {
        console.error(`Error deleting user ${userId}:`, deleteUserError)
      }
    }
    console.log('Deleted auth users')

    // 18. Delete account
    const { error: deleteAccountError } = await adminClient
      .from('accounts')
      .delete()
      .eq('id', account_id)

    if (deleteAccountError) {
      console.error('Error deleting account:', deleteAccountError)
      return new Response(
        JSON.stringify({ error: deleteAccountError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Account deleted successfully:', account_id)

    return new Response(
      JSON.stringify({ success: true }),
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
