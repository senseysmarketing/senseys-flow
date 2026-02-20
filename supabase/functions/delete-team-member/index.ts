import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteTeamMemberRequest {
  user_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id: targetUserId }: DeleteTeamMemberRequest = await req.json();

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'ID do usuário é obrigatório' }),
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

    // Get the calling user's info
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header is required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: callingUser, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !callingUser.user) {
      throw new Error('Invalid authentication token');
    }

    // Get the calling user's profile and check if they are the owner
    const { data: callingProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('account_id')
      .eq('user_id', callingUser.user.id)
      .single();

    if (profileError || !callingProfile) {
      throw new Error('Could not find user profile');
    }

    // Check if calling user is the owner
    const { data: callingUserRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select(`
        roles (
          name,
          is_system
        )
      `)
      .eq('user_id', callingUser.user.id)
      .single();

    if (roleError) {
      throw new Error('Could not verify user permissions');
    }

    const role = callingUserRole?.roles as { name: string; is_system: boolean } | null;
    const isOwner = role?.name === 'Proprietário' && role?.is_system === true;

    if (!isOwner) {
      return new Response(
        JSON.stringify({ error: 'Apenas o proprietário pode remover membros da equipe' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify that the target user belongs to the same account
    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from('profiles')
      .select('account_id, full_name')
      .eq('user_id', targetUserId)
      .single();

    if (targetProfileError || !targetProfile) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (targetProfile.account_id !== callingProfile.account_id) {
      return new Response(
        JSON.stringify({ error: 'Usuário não pertence à sua conta' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if target is the owner (cannot delete owner)
    const { data: targetUserRole } = await supabaseAdmin
      .from('user_roles')
      .select(`
        roles (
          name,
          is_system
        )
      `)
      .eq('user_id', targetUserId)
      .single();

    const targetRole = targetUserRole?.roles as { name: string; is_system: boolean } | null;
    if (targetRole?.name === 'Proprietário' && targetRole?.is_system === true) {
      return new Response(
        JSON.stringify({ error: 'Não é possível remover o proprietário da conta' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent self-deletion
    if (targetUserId === callingUser.user.id) {
      return new Response(
        JSON.stringify({ error: 'Você não pode remover a si mesmo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete user_roles first (due to FK constraint)
    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', targetUserId);

    if (rolesError) {
      throw new Error('Erro ao remover roles do usuário: ' + rolesError.message);
    }

    // Delete profile (cascades from auth.users won't work here, so do it manually)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', targetUserId);

    if (profileError) {
      throw new Error('Erro ao remover perfil do usuário: ' + profileError.message);
    }

    // Delete the user from auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (deleteError) {
      throw new Error('Erro ao remover usuário do auth: ' + deleteError.message);
    }

    console.log('Team member deleted successfully:', targetUserId, targetProfile.full_name);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Usuário removido com sucesso!'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error in delete-team-member function:', error);
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
