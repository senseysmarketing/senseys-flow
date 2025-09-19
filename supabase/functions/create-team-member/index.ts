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
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, full_name }: CreateTeamMemberRequest = await req.json();

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

    // Check if email already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserByEmail(email);
    if (existingUser?.user) {
      return new Response(
        JSON.stringify({ error: 'Este email já está cadastrado no sistema' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
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

    if (createError || !newUser.user) {
      console.error('Error creating user:', createError);
      throw new Error('Falha ao criar usuário: ' + (createError?.message || 'Erro desconhecido'));
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
      // Don't fail completely, as the user was created successfully
    }

    console.log('Team member created successfully:', newUser.user.email);

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