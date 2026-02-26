import { useState, useEffect, useCallback } from "react";
import { Wifi, WifiOff, ExternalLink, Zap, Clock, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/use-account";
import { useMessages, Conversation } from "@/hooks/use-conversations";
import { ChatView } from "@/components/conversations/ChatView";
import { useNavigate } from "react-router-dom";

interface WhatsAppChatModalProps {
  open: boolean;
  onClose: () => void;
  leadName: string;
  leadId?: string;
  phone: string;
  propertyName?: string;
  onShowLead?: () => void;
}

export function WhatsAppChatModal({ open, onClose, leadName, leadId, phone, propertyName, onShowLead }: WhatsAppChatModalProps) {
  const { account } = useAccount();
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loadingConnection, setLoadingConnection] = useState(true);

  const cleanPhone = phone.replace(/\D/g, '');
  const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  const remoteJid = `${fullPhone}@s.whatsapp.net`;

  const { messages, loading: messagesLoading, sendMessage, markAsRead } = useMessages(
    isConnected && conversation ? conversation.remote_jid : null,
    isConnected && conversation ? (conversation.lead_id || leadId || null) : null
  );

  // Check WhatsApp connection status with verification fallback
  useEffect(() => {
    if (!open || !account?.id) return;
    
    const checkConnection = async () => {
      setLoadingConnection(true);
      const { data: session } = await supabase
        .from('whatsapp_sessions')
        .select('status')
        .eq('account_id', account.id)
        .maybeSingle();
      
      if (!session) {
        setIsConnected(false);
        setLoadingConnection(false);
        return;
      }

      if (session.status === 'connected') {
        setIsConnected(true);
        setLoadingConnection(false);
        return;
      }

      // DB says not connected — verify with Evolution API
      try {
        const response = await supabase.functions.invoke('whatsapp-connect?action=status');
        if (!response.error && response.data?.connected) {
          setIsConnected(true);
        } else {
          setIsConnected(false);
        }
      } catch {
        setIsConnected(false);
      }
      setLoadingConnection(false);
    };
    
    checkConnection();
  }, [open, account?.id]);

  // Find or identify conversation when connected
  useEffect(() => {
    if (!open || !isConnected || !account?.id) return;

    const findConversation = async () => {
      // Try to find existing conversation by phone
      const { data: conv } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('account_id', account.id)
        .eq('remote_jid', remoteJid)
        .maybeSingle();

      if (conv) {
        setConversation({
          ...conv,
          unread_count: conv.unread_count ?? 0,
          last_message_is_from_me: conv.last_message_is_from_me ?? false,
          lead: {
            id: leadId || '',
            name: leadName,
            phone: fullPhone,
            email: null,
            temperature: null,
            status_id: null,
            property_id: null,
            assigned_broker_id: null,
            origem: null,
            interesse: null,
            observacoes: null,
          }
        });
        markAsRead();
      } else {
        // Create a virtual conversation object for ChatView
        setConversation({
          id: '',
          account_id: account.id,
          remote_jid: remoteJid,
          phone: fullPhone,
          contact_name: leadName,
          last_message: null,
          last_message_at: null,
          last_message_is_from_me: false,
          unread_count: 0,
          lead_id: leadId || null,
          lead: {
            id: leadId || '',
            name: leadName,
            phone: fullPhone,
            email: null,
            temperature: null,
            status_id: null,
            property_id: null,
            assigned_broker_id: null,
            origem: null,
            interesse: null,
            observacoes: null,
          }
        });
      }
    };

    findConversation();
  }, [open, isConnected, account?.id, remoteJid]);

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setConversation(null);
      setIsConnected(null);
    }
  }, [open]);

  const handleSend = useCallback(async (text: string) => {
    const result = await sendMessage(text, fullPhone, leadId);
    return result;
  }, [sendMessage, fullPhone, leadId]);

  const openWhatsAppWeb = () => {
    let message = '';
    if (leadName) {
      const firstName = leadName.split(' ')[0];
      if (propertyName) {
        message = `Olá ${firstName}! Tudo bem? Vi que você demonstrou interesse no imóvel *${propertyName}*. Estou à disposição para te ajudar com mais informações. Como posso te atender? 😊`;
      } else {
        message = `Olá ${firstName}! Tudo bem? Vi que você demonstrou interesse em nossos imóveis. Estou à disposição para te ajudar. Como posso te atender? 😊`;
      }
    }
    const textParam = message ? `?text=${encodeURIComponent(message)}` : '';
    window.open(`https://wa.me/${fullPhone}${textParam}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="!max-w-2xl !p-0 !gap-0 sm:!max-h-[80vh] overflow-hidden">
        <DialogTitle className="sr-only">Chat WhatsApp - {leadName}</DialogTitle>
        
        {loadingConnection ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : isConnected && conversation ? (
          <div className="h-[75vh] sm:h-[75vh] [&>div>div:first-child]:pr-10">
            <ChatView
              conversation={conversation}
              messages={messages}
              loading={messagesLoading}
              onSend={handleSend}
              onBack={onClose}
              onShowLead={() => { if (onShowLead) { onClose(); onShowLead(); } }}
              isMobile={false}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center text-center px-6 py-10 gap-6">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <WifiOff className="h-8 w-8 text-muted-foreground" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">WhatsApp não conectado</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Conecte seu WhatsApp para conversar com seus leads diretamente pelo CRM, enviar mensagens automáticas e manter todo o histórico centralizado.
              </p>
            </div>

            <div className="grid gap-3 text-left w-full max-w-xs">
              <div className="flex items-center gap-3 text-sm">
                <MessageSquare className="h-4 w-4 text-primary flex-shrink-0" />
                <span>Envie e receba mensagens pelo CRM</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Zap className="h-4 w-4 text-primary flex-shrink-0" />
                <span>Automações de saudação e follow-up</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-primary flex-shrink-0" />
                <span>Histórico completo de conversas</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full max-w-xs">
              <Button 
                className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => { onClose(); navigate('/settings'); }}
              >
                <Wifi className="h-4 w-4" />
                Conectar WhatsApp
              </Button>
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={openWhatsAppWeb}
              >
                <ExternalLink className="h-4 w-4" />
                Abrir no WhatsApp Web
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
