import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map OLX temperature to CRM temperature
const mapTemperature = (olxTemp?: string): string => {
  switch (olxTemp) {
    case 'Alta': return 'hot';
    case 'Média': return 'warm';
    case 'Baixa':
    default: return 'cold';
  }
};

// Map OLX leadType to CRM campanha
const mapLeadType = (leadType?: string): string | null => {
  switch (leadType) {
    case 'CONTACT_CHAT': return 'Chat';
    case 'CONTACT_FORM': return 'Formulário';
    case 'CLICK_WHATSAPP': return 'WhatsApp';
    case 'CLICK_SCHEDULE': return 'Agendamento';
    case 'PHONE_VIEW': return 'Visualização de Telefone';
    case 'VISIT_REQUEST': return 'Solicitação de Visita';
    default: return leadType || null;
  }
};

// Map OLX transactionType to CRM interesse
const mapTransactionType = (type?: string): string | null => {
  switch (type) {
    case 'SELL': return 'Compra';
    case 'RENT': return 'Aluguel';
    default: return type || null;
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const accountId = url.searchParams.get('account_id');

    console.log('[olx-webhook] Received request for account_id:', accountId);

    if (!accountId) {
      return new Response(
        JSON.stringify({ error: 'account_id is required as query parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify account exists
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', accountId)
      .single();

    if (accountError || !account) {
      console.error('[olx-webhook] Account not found:', accountId);
      return new Response(
        JSON.stringify({ error: 'Invalid account_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: Record<string, any>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[olx-webhook] Payload received:', JSON.stringify(body));

    // Validate OLX fingerprint
    if (!body.leadOrigin) {
      return new Response(
        JSON.stringify({ error: 'Invalid OLX payload: missing leadOrigin field' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!body.name) {
      return new Response(
        JSON.stringify({ error: 'Required field missing: name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build phone: prefer phoneNumber (already formatted), else concatenate ddd + phone
    const phone = body.phoneNumber || `${body.ddd || ''}${body.phone || ''}`;
    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Required field missing: phone or ddd+phone' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for duplicate using originLeadId stored in meta_lead_id
    if (body.originLeadId) {
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id')
        .eq('account_id', accountId)
        .eq('meta_lead_id', body.originLeadId)
        .single();

      if (existingLead) {
        console.log('[olx-webhook] Duplicate lead detected via originLeadId:', body.originLeadId);
        return new Response(
          JSON.stringify({ success: true, message: 'Lead already exists (duplicate)', lead_id: existingLead.id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Try to find property by clientListingId as reference_code
    let propertyId: string | null = null;
    let anuncioCode: string | null = null;
    if (body.clientListingId) {
      const { data: matchedProperty } = await supabase
        .from('properties')
        .select('id')
        .eq('account_id', accountId)
        .eq('reference_code', body.clientListingId)
        .single();

      if (matchedProperty) {
        propertyId = matchedProperty.id;
        console.log('[olx-webhook] Matched property by clientListingId:', propertyId);
      } else {
        anuncioCode = `Cód. OLX: ${body.clientListingId}`;
        console.log('[olx-webhook] No property found with reference_code:', body.clientListingId, '— saving as anuncio:', anuncioCode);
      }
    }

    // Normalize fields to CRM format
    const normalizedPayload = {
      account_id: accountId,
      name: body.name,
      phone: phone,
      email: body.email || null,
      observacoes: body.message || null,
      origem: 'Grupo OLX',
      temperature: mapTemperature(body.temperature),
      interesse: mapTransactionType(body.transactionType),
      campanha: mapLeadType(body.extraData?.leadType),
      meta_lead_id: body.originLeadId || null,
      anuncio: anuncioCode,
      property_id: propertyId || undefined,
    };

    console.log('[olx-webhook] Normalized payload:', JSON.stringify(normalizedPayload));

    // Forward to webhook-leads internal function
    const webhookLeadsUrl = `${supabaseUrl}/functions/v1/webhook-leads?account_id=${accountId}`;
    const internalResponse = await fetch(webhookLeadsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-call': 'true',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify(normalizedPayload),
    });

    const result = await internalResponse.json();
    console.log('[olx-webhook] webhook-leads response:', internalResponse.status, JSON.stringify(result));

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { status: internalResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[olx-webhook] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
