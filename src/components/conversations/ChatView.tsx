import { useState, useRef, useEffect } from "react";
import { ArrowLeft, User, Send, FileText, Check, CheckCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Conversation, Message } from "@/hooks/use-conversations";
import { cn, formatPhoneForDisplay } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { QuickTemplatesPopover } from "./QuickTemplatesPopover";
import { AvatarFallbackColored } from "@/components/ui/avatar-fallback-colored";

interface ChatViewProps {
  conversation: Conversation;
  messages: Message[];
  loading: boolean;
  onSend: (text: string) => Promise<boolean | undefined>;
  onBack: () => void;
  onShowLead: () => void;
  isMobile?: boolean;
}

function formatMessageDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM/yyyy");
}

function DeliveryIndicator({ status }: { status: string }) {
  if (status === 'read') return <CheckCheck className="h-3.5 w-3.5 text-primary" />;
  if (status === 'delivered') return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />;
  if (status === 'sent') return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
  return null;
}

export function ChatView({ conversation, messages, loading, onSend, onBack, onShowLead, isMobile }: ChatViewProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const displayName = conversation.lead?.name || conversation.contact_name || conversation.phone;

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSend = async () => {
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    setText("");
    await onSend(msg);
    setSending(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTemplateSelect = (template: string) => {
    setText(template);
    textareaRef.current?.focus();
  };

  // Group messages by date
  const grouped: { date: string; msgs: Message[] }[] = [];
  messages.forEach(msg => {
    const dateKey = formatMessageDate(msg.timestamp);
    const last = grouped[grouped.length - 1];
    if (last?.date === dateKey) {
      last.msgs.push(msg);
    } else {
      grouped.push({ date: dateKey, msgs: [msg] });
    }
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-white/10 flex items-center gap-3 px-4 flex-shrink-0">
        {(isMobile) && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-[#a6c8e1] hover:text-white hover:bg-white/5" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}

        <AvatarFallbackColored name={displayName} size="sm" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-white">{displayName}</p>
          <p className="text-[11px] text-[#a6c8e1]/60 truncate">
            {conversation.lead?.phone 
              ? formatPhoneForDisplay(conversation.lead.phone) 
              : formatPhoneForDisplay(conversation.phone) || conversation.contact_name || ''
            }
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white hover:text-white"
          onClick={() => {
            const phone = (conversation.lead?.phone || conversation.phone || '').replace(/\D/g, '');
            const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;
            window.open(`https://wa.me/${fullPhone}`, '_blank');
          }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">WhatsApp Web</span>
        </Button>

        {conversation.lead && (
          <Button variant="ghost" size="sm" onClick={onShowLead} className="gap-1.5 text-xs text-[#a6c8e1] hover:text-white hover:bg-white/5 border border-white/10">
            <User className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Lead</span>
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        {loading ? (
          <div className="py-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                <Skeleton className="h-10 w-48 rounded-xl" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          <div className="py-4 space-y-1">
            {grouped.map((group) => (
              <div key={group.date}>
                {/* Date separator */}
                <div className="flex items-center justify-center my-3">
                  <span className="text-[10px] bg-[#5a5f65] px-3 py-1 rounded-full text-[#a6c8e1] font-medium">
                    {group.date}
                  </span>
                </div>

                {group.msgs.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex mb-1",
                      msg.is_from_me ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                        msg.is_from_me
                          ? "bg-[#81afd1] text-white rounded-br-sm"
                          : "bg-[#5a5f65] text-white rounded-bl-sm"
                      )}
                    >
                      {msg.media_type !== 'text' && (
                        <div className="flex items-center gap-1.5 mb-1 text-xs opacity-80">
                          <FileText className="h-3 w-3" />
                          <span>{msg.media_type === 'image' ? 'Imagem' : msg.media_type === 'audio' ? 'Áudio' : msg.media_type === 'video' ? 'Vídeo' : 'Arquivo'}</span>
                        </div>
                      )}
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <div className={cn(
                        "flex items-center gap-1 mt-0.5",
                        msg.is_from_me ? "justify-end" : "justify-start"
                      )}>
                        <span className={cn(
                          "text-[10px]",
                          msg.is_from_me ? "text-white/60" : "text-white/50"
                        )}>
                          {format(new Date(msg.timestamp), "HH:mm")}
                        </span>
                        {msg.is_from_me && <DeliveryIndicator status={msg.status} />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-3 flex-shrink-0">
        <div className="flex items-end gap-2">
          <QuickTemplatesPopover 
            onSelect={handleTemplateSelect} 
            leadName={conversation.lead?.name}
            propertyName={conversation.lead?.properties?.title}
          />
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            className="min-h-[40px] max-h-[120px] resize-none text-sm rounded-xl"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="h-10 w-10 rounded-xl flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
