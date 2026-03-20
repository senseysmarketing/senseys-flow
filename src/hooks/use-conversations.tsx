import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/use-account";
import { toast } from "@/hooks/use-toast";

export interface Conversation {
  id: string;
  account_id: string;
  remote_jid: string;
  phone: string;
  contact_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_message_is_from_me: boolean;
  unread_count: number;
  lead_id: string | null;
  lead?: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    temperature: string | null;
    status_id: string | null;
    property_id: string | null;
    assigned_broker_id: string | null;
    origem: string | null;
    interesse: string | null;
    observacoes: string | null;
    lead_status?: { name: string; color: string } | null;
    properties?: { title: string } | null;
    profiles?: { full_name: string | null } | null;
  } | null;
}

export interface Message {
  id: string;
  content: string | null;
  media_type: string;
  media_url: string | null;
  is_from_me: boolean;
  status: string;
  timestamp: string;
  contact_name: string | null;
  message_id: string | null;
}

export function useConversations() {
  const { account } = useAccount();
  const accountId = account?.id;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState<boolean | null>(null);
  const [sessionPhone, setSessionPhone] = useState<string | null>(null);

  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedRefetch = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = setTimeout(() => fetchConversationsInner(), 300);
  }, []);

  const fetchConversationsInner = useCallback(async () => {
    if (!accountId) return;

    // First check WhatsApp connection status
    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('status, phone_number')
      .eq('account_id', accountId)
      .maybeSingle();

    let connected = session?.status === 'connected';
    
    // If DB says not connected, verify with Evolution API to avoid stale status
    if (session && !connected) {
      try {
        const response = await supabase.functions.invoke('whatsapp-connect?action=status');
        if (!response.error && response.data?.connected) {
          connected = true;
        }
      } catch {
        // trust DB
      }
    }

    setIsWhatsAppConnected(connected);
    setSessionPhone(session?.phone_number || null);

    if (!connected || !session?.phone_number) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const currentPhone = session.phone_number;
    const phoneSuffix = currentPhone.slice(-8);

    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('account_id', accountId)
      .or(`session_phone.eq.${currentPhone},session_phone.is.null,session_phone.like.%${phoneSuffix}`)
      .not('remote_jid', 'like', '%@lid')
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      return;
    }

    const convList = data || [];
    const leadSelect = 'id, name, phone, email, temperature, status_id, property_id, assigned_broker_id, origem, interesse, observacoes, lead_status:lead_status(name, color), properties:properties(title), profiles:profiles!leads_assigned_broker_id_fkey(full_name)';

    // Step 1: Batch-load all leads that already have a lead_id on the conversation (1 query)
    const convWithLeadId = convList.filter(c => c.lead_id);
    const convWithoutLeadId = convList.filter(c => !c.lead_id);

    const leadIds = convWithLeadId.map(c => c.lead_id as string);
    const leadsById = new Map<string, any>();

    if (leadIds.length > 0) {
      const { data: leadsData } = await supabase
        .from('leads')
        .select(leadSelect)
        .in('id', leadIds);
      for (const lead of leadsData || []) {
        leadsById.set(lead.id, lead);
      }
    }

    // Step 2: Batch-load all account leads for conversations without lead_id (1 query instead of N)
    const leadsByPhone = new Map<string, any>();
    const phoneUpdates: { convId: string; leadId: string }[] = [];

    if (convWithoutLeadId.length > 0) {
      const { data: allAccountLeads } = await supabase
        .from('leads')
        .select(leadSelect)
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      // Build a phone-suffix index for fast in-memory matching
      for (const lead of allAccountLeads || []) {
        const suffix = (lead.phone || '').replace(/\D/g, '').slice(-9);
        if (suffix && !leadsByPhone.has(suffix)) {
          leadsByPhone.set(suffix, lead);
        }
      }

      // Match each orphan conversation against the in-memory index
      for (const conv of convWithoutLeadId) {
        const suffix = (conv.phone || '').replace(/\D/g, '').slice(-9);
        if (suffix) {
          const matched = leadsByPhone.get(suffix);
          if (matched) {
            leadsById.set(conv.id, matched); // keyed by conv.id for orphans
            phoneUpdates.push({ convId: conv.id, leadId: matched.id });
          }
        }
      }
    }

    // Step 3: Persist lead_id links for matched orphan conversations (batch update)
    for (const { convId, leadId } of phoneUpdates) {
      supabase
        .from('whatsapp_conversations')
        .update({ lead_id: leadId })
        .eq('id', convId)
        .then(() => {}); // fire-and-forget
    }

    // Step 4: Build enriched list without any extra queries
    const enriched: Conversation[] = convList.map(conv => ({
      ...conv,
      lead: conv.lead_id
        ? (leadsById.get(conv.lead_id) || null)
        : (leadsById.get(conv.id) || null), // orphan conversations keyed by conv.id
    }));

    setConversations(enriched);
    setLoading(false);
  }, [accountId]);

  // Stable reference that debouncedRefetch can use
  const fetchConversations = fetchConversationsInner;

  // Update debouncedRefetch to use the inner function
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableDebouncedRefetch = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = setTimeout(() => fetchConversationsInner(), 300);
  }, [fetchConversationsInner]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Realtime subscription
  useEffect(() => {
    if (!accountId) return;

    const channel = supabase
      .channel('conversations-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'whatsapp_conversations', filter: `account_id=eq.${accountId}` },
        (payload) => {
          const updated = payload.new as any;
          setConversations(prev => {
            const exists = prev.some(c => c.id === updated.id);
            if (!exists) {
              stableDebouncedRefetch();
              return prev;
            }
            return prev
              .map(c => c.id === updated.id ? { ...c, ...updated } : c)
              .sort((a, b) =>
                new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
              );
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_conversations', filter: `account_id=eq.${accountId}` },
        () => {
          stableDebouncedRefetch();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [accountId, fetchConversations, stableDebouncedRefetch]);

  const filtered = conversations.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (c.contact_name?.toLowerCase().includes(term)) ||
      c.phone.includes(term) ||
      (c.lead?.name?.toLowerCase().includes(term))
    );
  });

  return {
    conversations: filtered,
    allConversations: conversations,
    loading,
    searchTerm,
    setSearchTerm,
    refetch: fetchConversations,
    isWhatsAppConnected,
    sessionPhone,
  };
}

export function useMessages(remoteJid: string | null, leadId?: string | null) {
  const { account } = useAccount();
  const accountId = account?.id;
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  // Extract phone suffix for flexible JID matching (handles 9th digit variations)
  const phoneSuffix = remoteJid
    ? remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@c.us', '').slice(-8)
    : null;

  const fetchMessagesFromDB = useCallback(async () => {
    if (!accountId || !phoneSuffix) return;

    const select = 'id, content, media_type, media_url, is_from_me, status, timestamp, contact_name, message_id';

    // Run both queries in parallel: by phone suffix AND by lead_id
    const byPhone = supabase
      .from('whatsapp_messages')
      .select(select)
      .eq('account_id', accountId)
      .ilike('remote_jid', `%${phoneSuffix}%`)
      .order('timestamp', { ascending: true })
      .limit(200)
      .then(r => r);

    const byLeadId = leadId
      ? supabase
          .from('whatsapp_messages')
          .select(select)
          .eq('account_id', accountId)
          .eq('lead_id', leadId)
          .order('timestamp', { ascending: true })
          .limit(200)
          .then(r => r)
      : Promise.resolve({ data: [], error: null });

    const [phoneResult, leadResult] = await Promise.all([byPhone, byLeadId]);

    if (phoneResult.error) {
      console.error('Error fetching messages by phone:', phoneResult.error);
      return;
    }
    if (leadResult.error) {
      console.error('Error fetching messages by lead_id:', leadResult.error);
    }

    // Merge and deduplicate by id, then sort chronologically
    const allMessages: Message[] = [];
    const seen = new Set<string>();
    for (const msg of [...(phoneResult.data || []), ...(leadResult.data || [])]) {
      if (!seen.has(msg.id)) {
        seen.add(msg.id);
        allMessages.push(msg);
      }
    }
    allMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    setMessages(allMessages);
  }, [accountId, phoneSuffix, leadId]);

  const fetchMessages = useCallback(async () => {
    if (!accountId || !remoteJid || !phoneSuffix) {
      setMessages([]);
      return;
    }

    setLoading(true);
    await fetchMessagesFromDB();
    setLoading(false);
  }, [accountId, remoteJid, phoneSuffix, fetchMessagesFromDB]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime for new messages
  useEffect(() => {
    if (!accountId || !remoteJid || !phoneSuffix) return;

    const channel = supabase
      .channel(`messages-${remoteJid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `account_id=eq.${accountId}` },
        (payload) => {
          const newMsg = payload.new as any;
          // Match by phone suffix instead of exact JID to handle 9th digit variations
          // Also match by lead_id to capture @lid messages
          const msgPhone = (newMsg.remote_jid || '').replace('@s.whatsapp.net', '').replace('@lid', '').replace('@c.us', '');
          const matchesByPhone = phoneSuffix && msgPhone.endsWith(phoneSuffix);
          const matchesByLeadId = leadId && newMsg.lead_id === leadId;
          if (matchesByPhone || matchesByLeadId) {
            setMessages(prev => {
              const incoming = {
                id: newMsg.id,
                content: newMsg.content,
                media_type: newMsg.media_type,
                media_url: newMsg.media_url,
                is_from_me: newMsg.is_from_me,
                status: newMsg.status,
                timestamp: newMsg.timestamp,
                contact_name: newMsg.contact_name,
                message_id: newMsg.message_id,
              };

              // Skip if message with same DB id already exists
              if (prev.some(m => m.id === incoming.id)) return prev;

              // If message_id matches an existing message, replace it (optimistic -> real)
              if (incoming.message_id && prev.some(m => m.message_id === incoming.message_id)) {
                return prev.map(m =>
                  m.message_id === incoming.message_id
                    ? { ...m, id: incoming.id, status: incoming.status }
                    : m
                );
              }

              // Detect duplicate by content+timestamp for outgoing messages (optimistic fallback)
              if (incoming.is_from_me) {
                const msgTime = new Date(incoming.timestamp).getTime();
                const isDuplicate = prev.some(m =>
                  m.is_from_me &&
                  m.content === incoming.content &&
                  Math.abs(new Date(m.timestamp).getTime() - msgTime) < 5000
                );
                if (isDuplicate) {
                  return prev.map(m =>
                    m.is_from_me &&
                    m.content === incoming.content &&
                    Math.abs(new Date(m.timestamp).getTime() - msgTime) < 5000
                      ? { ...m, id: incoming.id, status: incoming.status, message_id: incoming.message_id }
                      : m
                  );
                }
              }

              return [...prev, incoming];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'whatsapp_messages' },
        (payload) => {
          const updated = payload.new as any;
          const msgPhone = (updated.remote_jid || '').replace('@s.whatsapp.net', '').replace('@lid', '').replace('@c.us', '');
          if (msgPhone.endsWith(phoneSuffix)) {
            setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, status: updated.status } : m));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [accountId, remoteJid, phoneSuffix]);

  const sendMessage = async (text: string, phone: string, leadId?: string) => {
    if (!accountId) return;

    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          phone,
          message: text,
          lead_id: leadId || null,
        },
      });

      if (invokeError || !result) {
        toast({ title: "Erro ao enviar", description: invokeError?.message || "Falha no envio", variant: "destructive" });
        return false;
      }

      // Optimistically add sent message
      const newMsg: Message = {
        id: crypto.randomUUID(),
        content: text,
        media_type: 'text',
        media_url: null,
        is_from_me: true,
        status: 'sent',
        timestamp: new Date().toISOString(),
        contact_name: null,
        message_id: result.messageId || null,
      };
      setMessages(prev => [...prev, newMsg]);

      // Mark conversation as read
      if (remoteJid) {
        await supabase
          .from('whatsapp_conversations')
          .update({ unread_count: 0 })
          .eq('account_id', accountId)
          .eq('remote_jid', remoteJid);
      }

      return true;
    } catch (err) {
      console.error('Send error:', err);
      toast({ title: "Erro", description: "Falha ao enviar mensagem", variant: "destructive" });
      return false;
    }
  };

  const markAsRead = async () => {
    if (!accountId || !remoteJid) return;
    await supabase
      .from('whatsapp_conversations')
      .update({ unread_count: 0 })
      .eq('account_id', accountId)
      .eq('remote_jid', remoteJid);
  };

  return { messages, loading, sendMessage, markAsRead, refetch: fetchMessages };
}
