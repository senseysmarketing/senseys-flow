import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  account_id?: string;
  user_ids?: string[];
  title: string;
  body: string;
  url?: string;
  data?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
    const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      console.error("[OneSignal] Missing API credentials");
      return new Response(
        JSON.stringify({ error: "OneSignal credentials not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const payload: NotificationRequest = await req.json();
    console.log("[OneSignal] Received request:", JSON.stringify(payload));

    const { account_id, user_ids, title, body, url, data } = payload;

    let targetUserIds: string[] = [];

    // If user_ids provided directly, use them
    if (user_ids && user_ids.length > 0) {
      targetUserIds = user_ids;
      console.log(`[OneSignal] Using provided user_ids: ${targetUserIds.length} users`);
    }
    // If account_id provided, get all users from that account
    else if (account_id) {
      const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
      
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("account_id", account_id);

      if (error) {
        console.error("[OneSignal] Error fetching profiles:", error);
        throw error;
      }

      targetUserIds = profiles?.map(p => p.user_id) || [];
      console.log(`[OneSignal] Found ${targetUserIds.length} users in account ${account_id}`);
    }

    if (targetUserIds.length === 0) {
      console.log("[OneSignal] No target users found");
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No target users" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build OneSignal notification payload
    const notificationPayload: any = {
      app_id: ONESIGNAL_APP_ID,
      include_aliases: {
        external_id: targetUserIds
      },
      target_channel: "push",
      headings: { en: title },
      contents: { en: body },
    };

    // Add URL if provided
    if (url) {
      // Make sure it's a full URL
      const fullUrl = url.startsWith('http') 
        ? url 
        : `https://crmsenseys.com.br${url}`;
      notificationPayload.url = fullUrl;
    }

    // Add custom data if provided
    if (data) {
      notificationPayload.data = data;
    }

    console.log("[OneSignal] Sending notification:", JSON.stringify(notificationPayload));

    // Send to OneSignal API
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Authorization": `Key ${ONESIGNAL_REST_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(notificationPayload),
    });

    const result = await response.json();
    console.log("[OneSignal] API response:", JSON.stringify(result));

    if (!response.ok) {
      console.error("[OneSignal] API error:", result);
      return new Response(
        JSON.stringify({ error: "OneSignal API error", details: result }),
        { status: response.status, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: targetUserIds.length,
        onesignal_id: result.id,
        recipients: result.recipients || 0
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    console.error("[OneSignal] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
