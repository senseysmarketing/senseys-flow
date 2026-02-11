import { useState } from "react";
import { useConversations, useMessages, Conversation } from "@/hooks/use-conversations";
import { ConversationList } from "@/components/conversations/ConversationList";
import { ChatView } from "@/components/conversations/ChatView";
import { LeadPanel } from "@/components/conversations/LeadPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { MessageSquare } from "lucide-react";

const Conversations = () => {
  const { conversations, loading, searchTerm, setSearchTerm } = useConversations();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showLeadPanel, setShowLeadPanel] = useState(false);
  const isMobile = useIsMobile();

  const { messages, loading: messagesLoading, sendMessage, markAsRead } = useMessages(
    selectedConversation?.remote_jid || null
  );

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
      {/* Conversations sidebar */}
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

      {/* Chat area */}
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

      {/* Lead panel */}
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
