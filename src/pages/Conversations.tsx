import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useConversations, useMessages, Conversation } from "@/hooks/use-conversations";
import { ConversationList } from "@/components/conversations/ConversationList";
import { ChatView } from "@/components/conversations/ChatView";
import { LeadPanel } from "@/components/conversations/LeadPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePermissions } from "@/hooks/use-permissions";
import { MessageSquare, WifiOff, ShieldX, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

const Conversations = () => {
  const { conversations, loading, searchTerm, setSearchTerm, isWhatsAppConnected } = useConversations();
  const { hasPermission, loading: permLoading } = usePermissions();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showLeadPanel, setShowLeadPanel] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const { messages, loading: messagesLoading, sendMessage, markAsRead } = useMessages(
    selectedConversation?.remote_jid || null
  );

  // Permission check
  if (!permLoading && !hasPermission('conversations.view')) {
    return (
      <div className="h-[calc(100vh-8rem)] flex flex-col items-center justify-center text-muted-foreground gap-4 px-4">
        <div className="p-4 rounded-full bg-destructive/10">
          <ShieldX className="h-10 w-10 text-destructive" />
        </div>
        <p className="text-lg font-medium text-foreground">Acesso restrito</p>
        <p className="text-sm text-center max-w-md">
          Você não tem permissão para acessar as conversas. Solicite ao administrador da conta para liberar o acesso.
        </p>
      </div>
    );
  }

  // WhatsApp disconnected state
  if (isWhatsAppConnected === false) {
    return (
      <div className="h-[calc(100vh-8rem)] flex flex-col items-center justify-center text-muted-foreground gap-4 px-4">
        <div className="p-4 rounded-full bg-muted/50">
          <WifiOff className="h-10 w-10" />
        </div>
        <p className="text-lg font-medium text-foreground">WhatsApp não conectado</p>
        <p className="text-sm text-center max-w-md">
          Conecte seu WhatsApp nas configurações para ver e gerenciar suas conversas.
        </p>
        <Button onClick={() => navigate('/settings')} variant="outline" className="gap-2">
          <Settings className="h-4 w-4" />
          Ir para Configurações
        </Button>
      </div>
    );
  }

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    markAsRead();
  };

  const handleBack = () => {
    setSelectedConversation(null);
    setShowLeadPanel(false);
  };

  // Mobile: show one panel at a time
  if (isMobile) {
    if (selectedConversation && showLeadPanel && selectedConversation.lead) {
      return (
        <div className="h-[calc(100vh-8rem)] flex flex-col">
          <LeadPanel
            lead={selectedConversation.lead}
            onClose={() => setShowLeadPanel(false)}
            isMobile
          />
        </div>
      );
    }

    if (selectedConversation) {
      return (
        <div className="h-[calc(100vh-8rem)] flex flex-col">
          <ChatView
            conversation={selectedConversation}
            messages={messages}
            loading={messagesLoading}
            onSend={(text) => sendMessage(text, selectedConversation.phone, selectedConversation.lead?.id)}
            onBack={handleBack}
            onShowLead={() => setShowLeadPanel(true)}
            isMobile
          />
        </div>
      );
    }

    return (
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        <ConversationList
          conversations={conversations}
          loading={loading}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedId={null}
          onSelect={handleSelectConversation}
        />
      </div>
    );
  }

  // Desktop: multi-panel layout
  return (
    <div className="h-[calc(100vh-8rem)] flex rounded-xl border border-border overflow-hidden bg-card">
      <div className="w-80 xl:w-96 border-r border-border flex-shrink-0">
        <ConversationList
          conversations={conversations}
          loading={loading}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedId={selectedConversation?.id || null}
          onSelect={handleSelectConversation}
        />
      </div>

      <div className="flex-1 min-w-0">
        {selectedConversation ? (
          <ChatView
            conversation={selectedConversation}
            messages={messages}
            loading={messagesLoading}
            onSend={(text) => sendMessage(text, selectedConversation.phone, selectedConversation.lead?.id)}
            onBack={handleBack}
            onShowLead={() => setShowLeadPanel(!showLeadPanel)}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
            <div className="p-4 rounded-full bg-muted/50">
              <MessageSquare className="h-10 w-10" />
            </div>
            <p className="text-lg font-medium">Selecione uma conversa</p>
            <p className="text-sm">Escolha uma conversa ao lado para começar</p>
          </div>
        )}
      </div>

      {showLeadPanel && selectedConversation?.lead && (
        <div className="w-80 xl:w-96 border-l border-border flex-shrink-0">
          <LeadPanel
            lead={selectedConversation.lead}
            onClose={() => setShowLeadPanel(false)}
          />
        </div>
      )}
    </div>
  );
};

export default Conversations;
