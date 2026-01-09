import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushNotificationRequest {
  account_id?: string;
  user_id?: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

// Web Push requires specific crypto operations
async function generateJWT(
  header: Record<string, string>,
  payload: Record<string, unknown>,
  privateKeyPEM: string
): Promise<string> {
  const encoder = new TextEncoder();
  
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${headerB64}.${payloadB64}`;
  
  // Import the private key
  const keyData = privateKeyPEM
    .replace('-----BEGIN EC PRIVATE KEY-----', '')
    .replace('-----END EC PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    encoder.encode(unsignedToken)
  );
  
  // Convert signature from DER to raw format and base64url encode
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  
  return `${unsignedToken}.${signatureB64}`;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: Record<string, unknown>,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 12 * 60 * 60; // 12 hours
    
    const jwtHeader = { alg: 'ES256', typ: 'JWT' };
    const jwtPayload = { aud: audience, exp, sub: vapidSubject };
    
    // For web push, we'll use a simpler approach with fetch
    const payloadString = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const payloadBytes = encoder.encode(payloadString);
    
    // Create authorization header with VAPID
    const vapidAuth = `vapid t=${await generateJWT(jwtHeader, jwtPayload, vapidPrivateKey)}, k=${vapidPublicKey}`;
    
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Authorization': vapidAuth,
        'TTL': '86400',
        'Urgency': 'high'
      },
      body: payloadBytes
    });

    if (response.status === 201 || response.status === 200) {
      return { success: true, statusCode: response.status };
    } else if (response.status === 410 || response.status === 404) {
      // Subscription expired or invalid
      return { success: false, statusCode: response.status, error: 'Subscription expired' };
    } else {
      const errorText = await response.text();
      return { success: false, statusCode: response.status, error: errorText };
    }
  } catch (error) {
    console.error('[Push] Error sending push:', error);
    return { success: false, error: error.message };
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");

    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      console.error("[Push] VAPID keys not configured");
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: PushNotificationRequest = await req.json();
    console.log("[Push] Received request:", payload);

    const { account_id, user_id, title, body, url, tag, data } = payload;

    // Build query to get subscriptions
    let query = supabase
      .from("push_subscriptions")
      .select("*")
      .eq("is_active", true);

    if (user_id) {
      // Send to specific user
      query = query.eq("user_id", user_id);
    } else if (account_id) {
      // Send to all users in account
      query = query.eq("account_id", account_id);
    } else {
      return new Response(
        JSON.stringify({ error: "Either account_id or user_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: subscriptions, error: fetchError } = await query;

    if (fetchError) {
      console.error("[Push] Error fetching subscriptions:", fetchError);
      throw fetchError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("[Push] No active subscriptions found");
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No subscriptions" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[Push] Found ${subscriptions.length} subscriptions`);

    const pushPayload = {
      title,
      body,
      url: url || "/leads",
      tag: tag || "notification",
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      data: data || {}
    };

    let sent = 0;
    let failed = 0;
    const expiredSubscriptions: string[] = [];

    for (const sub of subscriptions) {
      const result = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        pushPayload,
        vapidPublicKey,
        vapidPrivateKey,
        vapidSubject
      );

      if (result.success) {
        sent++;
        console.log(`[Push] Sent to ${sub.device_name || 'device'}`);
      } else {
        failed++;
        console.error(`[Push] Failed to send to ${sub.device_name || 'device'}:`, result.error);
        
        if (result.statusCode === 410 || result.statusCode === 404) {
          expiredSubscriptions.push(sub.id);
        }
      }
    }

    // Clean up expired subscriptions
    if (expiredSubscriptions.length > 0) {
      console.log(`[Push] Removing ${expiredSubscriptions.length} expired subscriptions`);
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", expiredSubscriptions);
    }

    console.log(`[Push] Results - Sent: ${sent}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: subscriptions.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[Push] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
