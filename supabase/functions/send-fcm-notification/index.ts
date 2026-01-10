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

// Get Google OAuth access token using service account
async function getAccessToken(): Promise<string> {
  const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
  const privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY");
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");

  if (!projectId || !privateKey || !clientEmail) {
    throw new Error("Firebase credentials not configured");
  }

  // Create JWT for service account
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  // Base64URL encode
  const encoder = new TextEncoder();
  const base64url = (data: Uint8Array) => {
    const base64 = btoa(String.fromCharCode(...data));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const headerB64 = base64url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64url(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the private key and sign
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  
  // Fix escaped newlines from environment variable
  const fixedPrivateKey = privateKey.replace(/\\n/g, "\n");
  
  const pemContents = fixedPrivateKey
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = base64url(new Uint8Array(signature));
  const jwt = `${unsignedToken}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error("[FCM] Token exchange failed:", error);
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!projectId) {
      console.error("[FCM] Missing Firebase project ID");
      return new Response(
        JSON.stringify({ error: "Firebase credentials not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const payload: NotificationRequest = await req.json();
    console.log("[FCM] Received request:", JSON.stringify(payload));

    const { account_id, user_ids, title, body, url, data } = payload;

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    let targetUserIds: string[] = [];

    // If user_ids provided directly, use them
    if (user_ids && user_ids.length > 0) {
      targetUserIds = user_ids;
      console.log(`[FCM] Using provided user_ids: ${targetUserIds.length} users`);
    }
    // If account_id provided, get all users from that account
    else if (account_id) {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("account_id", account_id);

      if (error) {
        console.error("[FCM] Error fetching profiles:", error);
        throw error;
      }

      targetUserIds = profiles?.map((p) => p.user_id) || [];
      console.log(`[FCM] Found ${targetUserIds.length} users in account ${account_id}`);
    }

    if (targetUserIds.length === 0) {
      console.log("[FCM] No target users found");
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No target users" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get FCM tokens for target users from push_subscriptions table
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("user_id, endpoint")
      .in("user_id", targetUserIds)
      .eq("is_active", true);

    if (subError) {
      console.error("[FCM] Error fetching subscriptions:", subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("[FCM] No active FCM tokens found for users");
      return new Response(
        JSON.stringify({ 
          success: true, 
          sent: 0, 
          message: "No FCM tokens registered",
          target_users: targetUserIds.length
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[FCM] Found ${subscriptions.length} active FCM tokens`);

    // Get access token for FCM API
    const accessToken = await getAccessToken();

    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    // Send notification to each FCM token
    for (const sub of subscriptions) {
      const fcmToken = sub.endpoint; // We store FCM token in endpoint field

      const fcmPayload = {
        message: {
          token: fcmToken,
          notification: {
            title,
            body,
          },
          webpush: {
            fcm_options: {
              link: url?.startsWith("http") ? url : `https://crm.senseys.com.br${url || "/leads"}`,
            },
            notification: {
              icon: "/pwa-192x192.png",
              badge: "/pwa-192x192.png",
              vibrate: [200, 100, 200],
              requireInteraction: true,
            },
          },
          data: {
            ...data,
            url: url || "/leads",
            click_action: url?.startsWith("http") ? url : `https://crm.senseys.com.br${url || "/leads"}`,
          },
        },
      };

      try {
        const fcmResponse = await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(fcmPayload),
          }
        );

        if (fcmResponse.ok) {
          successCount++;
          console.log(`[FCM] Notification sent to user ${sub.user_id}`);
        } else {
          const errorData = await fcmResponse.json();
          console.error(`[FCM] Failed to send to user ${sub.user_id}:`, errorData);
          failureCount++;
          
          // If token is invalid, mark subscription as inactive
          if (errorData.error?.details?.some((d: any) => 
            d.errorCode === "UNREGISTERED" || d.errorCode === "INVALID_ARGUMENT"
          )) {
            await supabase
              .from("push_subscriptions")
              .update({ is_active: false })
              .eq("endpoint", fcmToken);
            console.log(`[FCM] Marked token as inactive for user ${sub.user_id}`);
          }
          
          errors.push(`User ${sub.user_id}: ${JSON.stringify(errorData.error)}`);
        }
      } catch (sendError: any) {
        console.error(`[FCM] Error sending to user ${sub.user_id}:`, sendError);
        failureCount++;
        errors.push(`User ${sub.user_id}: ${sendError.message}`);
      }
    }

    const responseData = {
      success: true,
      sent: successCount,
      failed: failureCount,
      total_tokens: subscriptions.length,
      target_users: targetUserIds.length,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    };

    console.log("[FCM] Final response:", JSON.stringify(responseData));

    return new Response(
      JSON.stringify(responseData),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[FCM] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
