import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateTeamMemberRequest {
  email: string;
  password: string;
  full_name: string;
  role_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, full_name, role_id }: CreateTeamMemberRequest = await req.json();

    if (!role_id) {
      return new Response(
        JSON.stringify({ error: 'O tipo de usuário (role) é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the calling user's account_id
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header is required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: user, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user.user) {
      throw new Error('Invalid authentication token');
    }

    // Get the user's account_id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Could not find user profile');
    }

    // Verify that the role belongs to the same account
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('id, name, account_id')
      .eq('id', role_id)
      .single();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Tipo de usuário não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (roleData.account_id !== profile.account_id) {
      return new Response(
        JSON.stringify({ error: 'Tipo de usuário não pertence à sua conta' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent creating another owner
    if (roleData.name === 'Proprietário') {
      return new Response(
        JSON.stringify({ error: 'Não é possível criar outro Proprietário. Escolha outro tipo de usuário.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the new user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        full_name
      },
      email_confirm: true // Auto-confirm email for team members
    });

    if (createError) {
      console.error('Error creating user:', createError);
      
      // Check if it's a duplicate email error -> attach existing user to this account
      const duplicate = createError.message?.includes('already been registered') || 
                        createError.message?.includes('email address is already registered') ||
                        createError.message?.includes('User already registered');
      if (duplicate) {
        // Find existing user by scanning admin users (no direct get by email)
        let existingUserId: string | null = null;
        const perPage = 100;
        for (let page = 1; page <= 10; page++) {
          const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
          if (listErr) break;
          const found = list.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
          if (found) {
            existingUserId = found.id;
            break;
          }
          if (!list.users.length) break;
        }

        if (!existingUserId) {
          return new Response(
            JSON.stringify({ error: 'Email já cadastrado, mas não foi possível localizar o usuário.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Ensure profile exists and attach to this account
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('user_id', existingUserId)
          .maybeSingle();

        if (existingProfile) {
          await supabaseAdmin
            .from('profiles')
            .update({ account_id: profile.account_id, full_name })
            .eq('user_id', existingUserId);
        } else {
          await supabaseAdmin
            .from('profiles')
            .insert({ user_id: existingUserId, account_id: profile.account_id, full_name });
        }

        // Update or create user_roles entry
        const { data: existingUserRole } = await supabaseAdmin
          .from('user_roles')
          .select('id')
          .eq('user_id', existingUserId)
          .maybeSingle();

        if (existingUserRole) {
          await supabaseAdmin
            .from('user_roles')
            .update({ role_id })
            .eq('user_id', existingUserId);
        } else {
          await supabaseAdmin
            .from('user_roles')
            .insert({ user_id: existingUserId, role_id });
        }

        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Usuário existente vinculado à sua equipe com sucesso!',
            user: { id: existingUserId, email, full_name }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error('Falha ao criar usuário: ' + (createError?.message || 'Erro desconhecido'));
    }

    if (!newUser.user) {
      throw new Error('Usuário criado mas dados não retornados');
    }

    // Update the new user's profile to use the same account_id
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        account_id: profile.account_id,
        full_name
      })
      .eq('user_id', newUser.user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
    }

    // Delete any existing user_role (from handle_new_user trigger) and assign the selected role
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', newUser.user.id);

    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: newUser.user.id,
        role_id
      });

    if (roleInsertError) {
      console.error('Error assigning role:', roleInsertError);
    }

    console.log('Team member created successfully:', newUser.user.email, 'with role:', roleData.name);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Usuário criado com sucesso!',
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          full_name
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error in create-team-member function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

serve(handler);
