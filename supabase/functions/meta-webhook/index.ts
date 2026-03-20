// Meta Lead Ads Webhook Handler - receives leadgen events from Facebook
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
};

const VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "";
const META_APP_SECRET = Deno.env.get("META_APP_SECRET") || "";

async function verifySignature(payload: string, signature: string): Promise<boolean> {
  if (!signature || !META_APP_SECRET) return false;
  const expected = signature.replace("sha256=", "");
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(META_APP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const buf = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("") === expected;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\?/g, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

async function hashData(data: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const BASIC_FIELDS = new Set([
  "full_name", "full name", "fullname", "nome", "name",
  "nome_completo", "nome completo", "nomecompleto",
  "first_name", "primeiro_nome", "first name",
  "last_name", "sobrenome", "last name", "ultimo_nome",
  "phone_number", "telefone", "phone",
  "email", "e-mail"
]);
const EXCLUDED_FIELDS = new Set([...BASIC_FIELDS]);

function extractLeadName(fields: Record<string, string>): string {
  const fullNameKeys = [
    "full_name", "full name", "fullname",
    "nome_completo", "nome completo", "nomecompleto",
    "nome", "name",
  ];
  for (const key of fullNameKeys) {
    if (fields[key]?.trim()) return fields[key].trim();
  }
  const firstName = fields["first_name"] || fields["primeiro_nome"] || fields["first name"] || "";
  const lastName = fields["last_name"] || fields["sobrenome"] || fields["last name"] || fields["ultimo_nome"] || "";
  if (firstName.trim()) {
    return lastName.trim() ? `${firstName.trim()} ${lastName.trim()}` : firstName.trim();
  }
  for (const [key, value] of Object.entries(fields)) {
    if ((key.includes("nome") || key.includes("name")) && value?.trim() && !key.includes("user")) {
      return value.trim();
    }
  }
  return "Lead do Facebook";
}

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Test endpoint
  if (url.searchParams.get("test") === "true") {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: token } = await supabase.from("meta_agency_token").select("user_name").eq("id", "00000000-0000-0000-0000-000000000001").single();
    const { data: configs } = await supabase.from("account_meta_config").select("account_id, page_id, is_active");
    return new Response(JSON.stringify({ status: "Webhook active", verify_token: !!VERIFY_TOKEN, app_secret: !!META_APP_SECRET, token: token ? { exists: true, user_name: token.user_name } : { exists: false }, accounts: configs || [] }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Webhook verification (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verified");
      return new Response(challenge, { headers: corsHeaders });
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  // Handle POST
  if (req.method === "POST") {
    try {
      const body = await req.text();
      const sig = req.headers.get("x-hub-signature-256");
      if (sig && META_APP_SECRET && !(await verifySignature(body, sig))) {
        return new Response("Invalid signature", { status: 401, headers: corsHeaders });
      }

      const data = JSON.parse(body);
      if (data.object !== "page") return new Response("OK", { headers: corsHeaders });

      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: tokenData } = await supabase.from("meta_agency_token").select("access_token").eq("id", "00000000-0000-0000-0000-000000000001").single();
      if (!tokenData?.access_token) return new Response("OK", { headers: corsHeaders });

      for (const entry of data.entry || []) {
        const pageId = entry.id;
        const { data: cfg } = await supabase.from("account_meta_config").select("account_id").eq("page_id", pageId).eq("is_active", true).single();
        if (!cfg) continue;

        for (const change of entry.changes || []) {
          if (change.field !== "leadgen") continue;
          const { leadgen_id, form_id, ad_id, adgroup_id } = change.value;

          const leadRes = await fetch(`https://graph.facebook.com/v19.0/${leadgen_id}?access_token=${tokenData.access_token}`);
          const leadJson = await leadRes.json();
          if (leadJson.error) continue;

          const fields: Record<string, string> = {};
          for (const f of leadJson.field_data || []) fields[f.name.toLowerCase()] = f.values?.[0] || "";

          const name = extractLeadName(fields);
          if (name === "Lead do Facebook") {
            console.warn("Could not extract lead name. Fields received:", JSON.stringify(Object.keys(fields)));
          }
          const phone = fields["phone_number"] || fields["telefone"] || fields["phone"] || "";
          const email = fields["email"] || fields["e-mail"] || "";

          // Calculate temperature
          let temp = "warm", score = 0, refCode: string | null = null;
          const { data: formCfg } = await supabase.from("meta_form_configs").select("*").eq("account_id", cfg.account_id).eq("form_id", form_id).single();
          if (formCfg) {
            // Normalized lookup for reference_field_name (case-insensitive)
            if (formCfg.reference_field_name) {
              const refNorm = normalize(formCfg.reference_field_name);
              for (const [k, v] of Object.entries(fields)) {
                if (normalize(k) === refNorm && v) { refCode = v; break; }
              }
            }
            const { data: rules } = await supabase.from("meta_form_scoring_rules").select("*").eq("form_config_id", formCfg.id);
            // Build normalized field map for case-insensitive scoring
            const fieldsByNorm: Record<string, string> = {};
            for (const [k, v] of Object.entries(fields)) fieldsByNorm[normalize(k)] = v;
            for (const r of rules || []) {
              const val = fieldsByNorm[normalize(r.question_name)];
              if (val && normalize(val) === normalize(r.answer_value)) score += r.score;
            }
            console.log(`Scoring for form ${form_id}: score=${score}, hot_threshold=${formCfg.hot_threshold}, warm_threshold=${formCfg.warm_threshold}`);
            temp = score >= formCfg.hot_threshold ? "hot" : score >= formCfg.warm_threshold ? "warm" : "cold";
          } else {
            await supabase.from("meta_form_configs").insert({ account_id: cfg.account_id, form_id, hot_threshold: 3, warm_threshold: 1, is_configured: false });
          }

          const finalRef = refCode || fields["reference_code"] || fields["ref"] || "";
          let adName = "", campName = "", campId = "", isIg = false, adsetName = "";

          if (ad_id) {
            try {
              const ad = await (await fetch(`https://graph.facebook.com/v19.0/${ad_id}?fields=name,campaign{id,name},effective_instagram_media_id&access_token=${tokenData.access_token}`)).json();
              if (!ad.error) { adName = ad.name || ""; campName = ad.campaign?.name || ""; campId = ad.campaign?.id || ""; isIg = !!ad.effective_instagram_media_id; }
            } catch (adErr) {
              console.error("Error fetching ad info:", adErr);
            }
          }
          if (adgroup_id) {
            try {
              const adset = await (await fetch(`https://graph.facebook.com/v19.0/${adgroup_id}?fields=name&access_token=${tokenData.access_token}`)).json();
              if (!adset.error) adsetName = adset.name || "";
            } catch (adsetErr) {
              console.error("Error fetching adset info:", adsetErr);
            }
          }

          const { data: existing } = await supabase.from("leads").select("id").eq("meta_lead_id", leadgen_id).single();
          if (existing) continue;

          let propId = null;
          if (finalRef) {
            const { data: prop } = await supabase.from("properties").select("id").eq("account_id", cfg.account_id).eq("reference_code", finalRef).single();
            propId = prop?.id || null;
          }

          const { data: statusRow } = await supabase.from("lead_status").select("id").eq("account_id", cfg.account_id).eq("name", "Novo Lead").single();
          let statusId = statusRow?.id;
          if (!statusId) {
            const { data: def } = await supabase.from("lead_status").select("id").eq("account_id", cfg.account_id).eq("is_default", true).single();
            statusId = def?.id;
          }

          // Duplicate detection
          let isDuplicate = false;
          let duplicateOfLeadId: string | null = null;
          const phoneSuffix = phone.replace(/\D/g, "").slice(-9);
          if (phoneSuffix.length >= 9) {
            const { data: existingLeads } = await supabase.from("leads").select("id, phone, email, created_at").eq("account_id", cfg.account_id).order("created_at", { ascending: false }).limit(500);
            if (existingLeads && existingLeads.length > 0) {
              const match = existingLeads.find((l: any) => {
                const es = l.phone.replace(/\D/g, "").slice(-9);
                if (es.length >= 9 && es === phoneSuffix) return true;
                if (email && l.email && email.toLowerCase() === l.email.toLowerCase()) return true;
                return false;
              });
              if (match) { isDuplicate = true; duplicateOfLeadId = match.id; console.log(`Duplicate detected: ${match.id}`); }
            }
          }

          const { data: newLead, error: insertErr } = await supabase.from("leads").insert({
            account_id: cfg.account_id, name, phone, email: email || null, origem: isIg ? "Instagram" : "Facebook",
            campanha: campName || null, conjunto: adsetName || null, anuncio: adName || null, status_id: statusId,
            property_id: propId, meta_lead_id: leadgen_id, meta_form_id: form_id, meta_ad_id: ad_id,
            meta_campaign_id: campId, meta_ad_name: adName, meta_campaign_name: campName, temperature: temp,
            is_duplicate: isDuplicate, duplicate_of_lead_id: duplicateOfLeadId,
          }).select("id").single();

          if (insertErr || !newLead) continue;
          console.log("Lead created:", newLead.id);

          // Distribution rules
          let brokerId: string | undefined;
          try {
            const dist = await supabase.functions.invoke("apply-distribution-rules", { body: { lead_id: newLead.id, account_id: cfg.account_id } });
            console.log("Distribution result:", JSON.stringify(dist.data));
            if (dist.data?.success) {
              brokerId = dist.data.broker_id;
              console.log(`Lead ${newLead.id} assigned to broker: ${dist.data.broker_name}`);
            } else {
              console.log("Distribution did not assign:", dist.data?.reason);
            }
          } catch (distErr) {
            console.error("Distribution error:", distErr);
          }

          // Store custom fields
          for (const [k, v] of Object.entries(fields)) {
            if (EXCLUDED_FIELDS.has(k) || !v) continue;
            const { data: cf } = await supabase.from("custom_fields").select("id").eq("account_id", cfg.account_id).eq("field_key", k).single();
            if (cf) await supabase.from("lead_custom_field_values").insert({ lead_id: newLead.id, custom_field_id: cf.id, value: v });
            else {
              const { data: nCf } = await supabase.from("custom_fields").insert({ account_id: cfg.account_id, name: k.replace(/_/g, " "), field_key: k, field_type: "text", is_active: true, is_required: false }).select("id").single();
              if (nCf) await supabase.from("lead_custom_field_values").insert({ lead_id: newLead.id, custom_field_id: nCf.id, value: v });
            }
            // TAMBÉM salvar em lead_form_field_values para suporte a {form_*} nos templates
            await supabase.from("lead_form_field_values").insert({
              lead_id: newLead.id,
              field_name: k,
              field_label: k.replace(/_/g, " ").replace(/\?/g, "").trim(),
              field_value: v,
            });
          }

          // Activity log handled by database trigger (log_lead_activity)

          // Notify
          try {
            let propName = null;
            if (propId) { const { data: p } = await supabase.from("properties").select("title").eq("id", propId).single(); propName = p?.title || null; }
            await supabase.functions.invoke("notify-new-lead", { body: { lead_id: newLead.id, lead_name: name, lead_phone: phone, lead_email: email, lead_temperature: temp, lead_origem: "Facebook Lead Ads", property_name: propName, account_id: cfg.account_id, assigned_broker_id: brokerId } });
          } catch (notifyErr) {
            console.error("Notify error for lead:", newLead.id, notifyErr);
          }

          // Check for WhatsApp greeting (conditional rules first, then default automation rule)
          try {
            const { data: whatsappSession } = await supabase
              .from("whatsapp_sessions")
              .select("status")
              .eq("account_id", cfg.account_id)
              .eq("status", "connected")
              .single();

            if (!whatsappSession) {
              console.log(`WhatsApp not connected for account ${cfg.account_id}`);
            } else {
              // Fetch all active greeting rules ordered by priority
              const { data: greetingRules } = await supabase
                .from("whatsapp_greeting_rules" as any)
                .select("*")
                .eq("account_id", cfg.account_id)
                .eq("is_active", true)
                .order("priority", { ascending: true });

              // Fetch property info for rule matching
              let propertyInfo: { sale_price: number | null; rent_price: number | null; type: string | null; transaction_type: string | null } | null = null;
              let propertyName: string | null = null;
              if (propId) {
                const { data: propData } = await supabase
                  .from("properties")
                  .select("title, sale_price, rent_price, type, transaction_type")
                  .eq("id", propId)
                  .single();
                if (propData) {
                  propertyName = propData.title || null;
                  propertyInfo = { sale_price: propData.sale_price, rent_price: propData.rent_price, type: propData.type, transaction_type: propData.transaction_type };
                }
              }

              // Evaluate conditional rules in priority order
              let matchedRule: any = null;
              const leadOriginNormalized = (isIg ? "instagram" : "facebook");

              for (const rule of (greetingRules || [])) {
                switch (rule.condition_type) {
                  case "property":
                    if (propId && rule.condition_property_id === propId) matchedRule = rule;
                    break;
                  case "price_range": {
                    const price = propertyInfo?.sale_price || propertyInfo?.rent_price;
                    if (price) {
                      const minOk = !rule.condition_price_min || price >= rule.condition_price_min;
                      const maxOk = !rule.condition_price_max || price <= rule.condition_price_max;
                      if (minOk && maxOk) matchedRule = rule;
                    }
                    break;
                  }
                  case "property_type":
                    if (propertyInfo?.type && rule.condition_property_type &&
                        propertyInfo.type.toLowerCase() === rule.condition_property_type.toLowerCase()) matchedRule = rule;
                    break;
                  case "transaction_type":
                    if (propertyInfo?.transaction_type && rule.condition_transaction_type &&
                        propertyInfo.transaction_type.toLowerCase() === rule.condition_transaction_type.toLowerCase()) matchedRule = rule;
                    break;
                  case "campaign":
                    if (rule.condition_campaign && campName &&
                        campName.toLowerCase().includes(rule.condition_campaign.toLowerCase())) matchedRule = rule;
                    break;
                  case "origin":
                    if (rule.condition_origin && leadOriginNormalized.includes(rule.condition_origin.toLowerCase())) matchedRule = rule;
                    break;
                  case "form_answer":
                    if (rule.condition_form_question && rule.condition_form_answer) {
                      const { data: formFieldVals } = await supabase
                        .from("lead_form_field_values")
                        .select("field_name, field_value")
                        .eq("lead_id", newLead.id);
                      if (formFieldVals && formFieldVals.length > 0) {
                        const norm = (s: string) => s.toLowerCase().replace(/\?/g, "").replace(/_/g, " ").trim();
                        const found = formFieldVals.find(fv =>
                          norm(fv.field_name) === norm(rule.condition_form_question!) &&
                          fv.field_value !== null && norm(fv.field_value) === norm(rule.condition_form_answer!)
                        );
                        if (found) matchedRule = rule;
                      }
                    }
                    break;
                }
                if (matchedRule) break;
              }

              // Determine template and delay
              let templateId: string | null = null;
              let delaySeconds = 0;
              let ruleId: string | null = null;

              if (matchedRule && matchedRule.template_id) {
                templateId = matchedRule.template_id;
                delaySeconds = matchedRule.delay_seconds || 0;
                console.log(`Conditional greeting rule matched: ${matchedRule.name} (type: ${matchedRule.condition_type})`);
              } else {
                // Fallback: default whatsapp_automation_rules
                const { data: automationRule } = await supabase
                  .from("whatsapp_automation_rules")
                  .select("*")
                  .eq("account_id", cfg.account_id)
                  .eq("trigger_type", "new_lead")
                  .eq("is_active", true)
                  .single();

                if (automationRule) {
                  const sources = automationRule.trigger_sources || { meta: true };
                  const metaEnabled = typeof sources === "object" && sources !== null
                    ? (sources as Record<string, boolean>).meta !== false : true;

                  if (automationRule.template_id && metaEnabled) {
                    templateId = automationRule.template_id;
                    delaySeconds = automationRule.delay_seconds || 0;
                    ruleId = automationRule.id;
                    console.log(`Fallback to default automation rule: ${automationRule.name}`);
                  } else {
                    console.log(`Meta source disabled or no template for automation rule ${automationRule.id}`);
                  }
                } else {
                  console.log(`No active automation rule for account ${cfg.account_id}`);
                }
              }

              if (templateId) {
                // ═══ Build steps_snapshot for automation control ═══
                const stepsSnapshot: { greeting: any[]; followup: any[] } = { greeting: [], followup: [] };

                // Get greeting sequence steps
                const seqQuery = (supabase as any)
                  .from("whatsapp_greeting_sequence_steps")
                  .select("*")
                  .eq("is_active", true)
                  .order("position");

                const seqFilter = matchedRule
                  ? seqQuery.eq("greeting_rule_id", matchedRule.id)
                  : (ruleId ? seqQuery.eq("automation_rule_id", ruleId) : null);

                const { data: seqSteps } = seqFilter ? await seqFilter : { data: null };

                if (seqSteps && seqSteps.length > 0) {
                  for (const step of seqSteps) {
                    const { data: tmpl } = await supabase
                      .from("whatsapp_templates")
                      .select("template")
                      .eq("id", step.template_id)
                      .single();
                    stepsSnapshot.greeting.push({
                      delay_seconds: step.delay_seconds || 0,
                      template_id: step.template_id,
                      template_content: tmpl?.template || "",
                    });
                  }
                } else if (templateId) {
                  const { data: tmpl } = await supabase
                    .from("whatsapp_templates")
                    .select("template")
                    .eq("id", templateId)
                    .single();
                  stepsSnapshot.greeting.push({
                    delay_seconds: 0,
                    template_id: templateId,
                    template_content: tmpl?.template || "",
                  });
                }

                // Get followup steps
                const { data: followUpSteps } = await supabase
                  .from("whatsapp_followup_steps")
                  .select("*")
                  .eq("account_id", cfg.account_id)
                  .eq("is_active", true)
                  .order("position");

                if (followUpSteps && followUpSteps.length > 0) {
                  for (const step of followUpSteps as any[]) {
                    const { data: tmpl } = await supabase
                      .from("whatsapp_templates")
                      .select("template")
                      .eq("id", step.template_id)
                      .single();
                    stepsSnapshot.followup.push({
                      delay_minutes: step.delay_minutes,
                      template_id: step.template_id,
                      template_content: tmpl?.template || "",
                    });
                  }
                }

                // Insert automation control record
                const { error: controlError } = await supabase
                  .from("whatsapp_automation_control")
                  .insert({
                    account_id: cfg.account_id,
                    lead_id: newLead.id,
                    automation_rule_id: ruleId,
                    phone: phone,
                    current_phase: "greeting",
                    current_step_position: 0,
                    status: "active",
                    next_execution_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
                    steps_snapshot: stepsSnapshot,
                  });

                if (controlError) {
                  console.error("Error creating automation control:", controlError);
                } else {
                  console.log(`✅ Automation control created for lead ${newLead.id} (greeting: ${stepsSnapshot.greeting.length} steps, followup: ${stepsSnapshot.followup.length} steps)`);
                }

                // Trigger worker
                supabase.functions.invoke("process-whatsapp-queue").catch(() => {});
              }
            }
          } catch (whatsappErr) {
            console.error("WhatsApp automation error for lead:", newLead.id, whatsappErr);
          }

          // CAPI
          if (temp === "hot") {
            try {
              const { data: px } = await supabase.from("account_meta_config").select("pixel_id").eq("account_id", cfg.account_id).single();
              if (px?.pixel_id) {
                const ts = Math.floor(Date.now() / 1000);
                const evtId = `${newLead.id}_Lead_${ts}`;
                const ud: Record<string, any> = { lead_id: leadgen_id };
                if (email) ud.em = [await hashData(email.toLowerCase().trim())];
                if (phone) { let p = phone.replace(/\D/g, ""); if (p.length <= 11) p = "55" + p; ud.ph = [await hashData(p)]; }
                const payload = { data: [{ event_name: "LeadQualificado", event_time: ts, event_id: evtId, action_source: "system_generated", user_data: ud, custom_data: { lead_event_source: "Senseys CRM", lead_type: "qualified", qualification_score: score } }] };
                const capiRes = await fetch(`https://graph.facebook.com/v19.0/${px.pixel_id}/events?access_token=${tokenData.access_token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                const capiJson = await capiRes.json();
                await supabase.from("meta_capi_events_log").insert({ lead_id: newLead.id, account_id: cfg.account_id, event_name: "LeadQualificado", event_id: evtId, pixel_id: px.pixel_id, status_code: capiRes.status, response_body: capiJson, error_message: capiJson.error?.message || null });
              }
            } catch (capiErr) {
              console.error("CAPI error for lead:", newLead.id, capiErr);
            }
          }
        }
      }
      return new Response("OK", { headers: corsHeaders });
    } catch (e) {
      console.error("Webhook error:", e);
      return new Response("OK", { headers: corsHeaders });
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
};

serve(handler);
