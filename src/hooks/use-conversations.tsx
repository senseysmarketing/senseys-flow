import { useState, useEffect, useCallback } from "react";
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

  const fetchConversations = useCallback(async () => {
    if (!accountId) return;

    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('account_id', accountId)
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      return;
    }

    // Enrich with lead data
    const enriched: Conversation[] = [];
    for (const conv of data || []) {
      let lead = null;
      if (conv.lead_id) {
        const { data: leadData } = await supabase
          .from('leads')
          .select('id, name, phone, email, temperature, status_id, property_id, assigned_broker_id, origem, interesse, observacoes, lead_status:lead_status(name, color), properties:properties(title), profiles:profiles!leads_assigned_broker_id_fkey(full_name)')
          .eq('id', conv.lead_id)
          .maybeSingle();
        lead = leadData;
      } else {
        // Try to find by phone
        const phoneSuffix = conv.phone.slice(-9);
        const { data: leadData } = await supabase
          .from('leads')
          .select('id, name, phone, email, temperature, status_id, property_id, assigned_broker_id, origem, interesse, observacoes, lead_status:lead_status(name, color), properties:properties(title), profiles:profiles!leads_assigned_broker_id_fkey(full_name)')
          .eq('account_id', accountId)
          .ilike('phone', `%${phoneSuffix}%`)
          .order('created_at', { ascending: false })
          .limit(1);
        if (leadData?.[0]) {
          lead = leadData[0];
          await supabase
            .from('whatsapp_conversations')
            .update({ lead_id: leadData[0].id })
            .eq('id', conv.id);
        }
      }
      enriched.push({ ...conv, lead });
    }
    
    setConversations(enriched);
    setLoading(false);
  }, [accountId]);

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
        { event: '*', schema: 'public', table: 'whatsapp_conversations', filter: `account_id=eq.${accountId}` },
        () => { fetchConversations(); }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `account_id=eq.${accountId}` },
        () => { fetchConversations(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [accountId, fetchConversations]);

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
  };
}

export function useMessages(remoteJid: string | null) {
  const { account } = useAccount();
  const accountId = account?.id;
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  // Extract phone suffix for flexible JID matching (handles 9th digit variations)
  const phoneSuffix = remoteJid
    ? remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@c.us', '').slice(-8)
    : null;

  const fetchMessages = useCallback(async () => {
    if (!accountId || !remoteJid || !phoneSuffix) {
      setMessages([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('id, content, media_type, media_url, is_from_me, status, timestamp, contact_name, message_id')
      .eq('account_id', accountId)
      .ilike('remote_jid', `%${phoneSuffix}%`)
      .order('timestamp', { ascending: true })
      .limit(200);

    if (error) {
      console.error('Error fetching messages:', error);
    } else {
      setMessages(data || []);
    }
    setLoading(false);
  }, [accountId, remoteJid, phoneSuffix]);

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
          const msgPhone = (newMsg.remote_jid || '').replace('@s.whatsapp.net', '').replace('@lid', '').replace('@c.us', '');
          if (msgPhone.endsWith(phoneSuffix)) {
            setMessages(prev => [...prev, {
              id: newMsg.id,
              content: newMsg.content,
              media_type: newMsg.media_type,
              media_url: newMsg.media_url,
              is_from_me: newMsg.is_from_me,
              status: newMsg.status,
              timestamp: newMsg.timestamp,
              contact_name: newMsg.contact_name,
              message_id: newMsg.message_id,
            }]);
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

    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) {
      toast({ title: "Erro", description: "Sessão expirada", variant: "destructive" });
      return;
    }

    try {
      const response = await fetch(
        `https://ujodxlzlfvdwqufkgdnw.supabase.co/functions/v1/whatsapp-send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({
            phone,
            message: text,
            lead_id: leadId || null,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        toast({ title: "Erro ao enviar", description: result.error || "Falha no envio", variant: "destructive" });
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
