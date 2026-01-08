import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyNewLeadRequest {
  lead_id: string;
  lead_name: string;
  lead_phone: string;
  lead_email?: string;
  lead_temperature?: string;
  lead_origem?: string;
  property_name?: string;
  account_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotifyNewLeadRequest = await req.json();
    console.log("Received notification request:", payload);

    const { lead_id, lead_name, lead_phone, lead_email, lead_temperature, lead_origem, property_name, account_id } = payload;

    // Get account info
    const { data: account } = await supabase
      .from("accounts")
      .select("name, company_name")
      .eq("id", account_id)
      .single();

    // Get all team members with notification preferences
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("account_id", account_id);

    if (!profiles || profiles.length === 0) {
      console.log("No profiles found for account");
      return new Response(JSON.stringify({ success: true, message: "No profiles to notify" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const notifications: { email: number; push: number } = { email: 0, push: 0 };

    for (const profile of profiles) {
      // Get notification preferences for this user
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", profile.user_id)
        .single();

      // Default preferences if not set
      const emailEnabled = prefs?.email_enabled ?? true;
      const emailForHot = prefs?.email_for_hot ?? true;
      const emailForWarm = prefs?.email_for_warm ?? true;
      const emailForCold = prefs?.email_for_cold ?? false;
      const notifyEmail = prefs?.notify_email;

      // Check if should send email based on temperature
      let shouldSendEmail = emailEnabled && notifyEmail;
      if (shouldSendEmail && lead_temperature) {
        if (lead_temperature === "hot" && !emailForHot) shouldSendEmail = false;
        if (lead_temperature === "warm" && !emailForWarm) shouldSendEmail = false;
        if (lead_temperature === "cold" && !emailForCold) shouldSendEmail = false;
      }

      // Send email notification
      if (shouldSendEmail && resendApiKey) {
        try {
          const temperatureLabel = lead_temperature === "hot" ? "🔥 Quente" : 
                                   lead_temperature === "warm" ? "🌡️ Morno" : "❄️ Frio";
          const temperatureColor = lead_temperature === "hot" ? "#ef4444" : 
                                   lead_temperature === "warm" ? "#f59e0b" : "#3b82f6";

          const appUrl = "https://crm.senseys.com.br";
          
          const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Novo Lead - ${lead_name}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f0f1a;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 32px; border: 1px solid #2a2a4a;">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 700;">
          🎉 Novo Lead Recebido!
        </h1>
      </div>

      <!-- Lead Info Card -->
      <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; margin-bottom: 16px;">
          <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 16px;">
            <span style="color: white; font-size: 20px; font-weight: 700;">${lead_name.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <h2 style="color: #ffffff; font-size: 20px; margin: 0; font-weight: 600;">${lead_name}</h2>
            <span style="display: inline-block; background: ${temperatureColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-top: 4px;">
              ${temperatureLabel}
            </span>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
              <span style="color: #9ca3af; font-size: 14px;">📱 Telefone</span>
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: right;">
              <a href="https://wa.me/55${lead_phone.replace(/\D/g, '')}" style="color: #22c55e; font-weight: 600; text-decoration: none;">${lead_phone}</a>
            </td>
          </tr>
          ${lead_email ? `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
              <span style="color: #9ca3af; font-size: 14px;">✉️ Email</span>
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: right;">
              <span style="color: #ffffff;">${lead_email}</span>
            </td>
          </tr>
          ` : ''}
          ${lead_origem ? `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
              <span style="color: #9ca3af; font-size: 14px;">📍 Origem</span>
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: right;">
              <span style="color: #ffffff;">${lead_origem}</span>
            </td>
          </tr>
          ` : ''}
          ${property_name ? `
          <tr>
            <td style="padding: 12px 0;">
              <span style="color: #9ca3af; font-size: 14px;">🏠 Imóvel</span>
            </td>
            <td style="padding: 12px 0; text-align: right;">
              <span style="color: #ffffff;">${property_name}</span>
            </td>
          </tr>
          ` : ''}
        </table>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center;">
        <a href="${appUrl}/leads" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          Ver Lead no CRM →
        </a>
      </div>

      <!-- Footer -->
      <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.1);">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          ${account?.company_name || account?.name || 'Sua Imobiliária'} • Powered by Senseys CRM
        </p>
      </div>
    </div>
  </div>
</body>
</html>
          `;

          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Senseys CRM <notificacoes@lead.crmsenseys.com.br>",
              to: [notifyEmail],
              subject: `🎉 Novo Lead: ${lead_name}`,
              html: emailHtml,
            }),
          });

          if (emailResponse.ok) {
            notifications.email++;
            console.log(`Email sent to ${notifyEmail}`);
          } else {
            const error = await emailResponse.text();
            console.error(`Failed to send email to ${notifyEmail}:`, error);
          }
        } catch (emailError) {
          console.error("Error sending email:", emailError);
        }
      }

      // TODO: Add push notification support here when VAPID keys are configured
    }

    console.log(`Notifications sent - Email: ${notifications.email}, Push: ${notifications.push}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notifications 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in notify-new-lead:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
