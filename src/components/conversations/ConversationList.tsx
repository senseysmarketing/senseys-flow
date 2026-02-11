import { Search, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Conversation } from "@/hooks/use-conversations";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AvatarFallbackColored } from "@/components/ui/avatar-fallback-colored";
import { Badge } from "@/components/ui/badge";

interface ConversationListProps {
  conversations: Conversation[];
  loading: boolean;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedId: string | null;
  onSelect: (conv: Conversation) => void;
}

export function ConversationList({
  conversations,
  loading,
  searchTerm,
  onSearchChange,
  selectedId,
  onSelect,
}: ConversationListProps) {
  const getDisplayName = (conv: Conversation) => {
    if (conv.lead?.name) return conv.lead.name;
    if (conv.contact_name) return conv.contact_name;
    // Format phone
    const p = conv.phone;
    if (p.length >= 12) {
      return `+${p.slice(0, 2)} (${p.slice(2, 4)}) ${p.slice(4, 9)}-${p.slice(9)}`;
    }
    return p;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Conversas
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-3 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <MessageSquare className="h-8 w-8" />
            <p className="text-sm">
              {searchTerm ? "Nenhuma conversa encontrada" : "Nenhuma conversa ainda"}
            </p>
          </div>
        ) : (
          <div className="p-1">
            {conversations.map((conv) => {
              const displayName = getDisplayName(conv);
              const isSelected = selectedId === conv.id;

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                    isSelected
                      ? "bg-primary/10"
                      : "hover:bg-muted/50"
                  )}
                >
                  <AvatarFallbackColored name={displayName} size="md" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        "text-sm truncate",
                        conv.unread_count > 0 ? "font-semibold text-foreground" : "font-medium text-foreground/90"
                      )}>
                        {displayName}
                      </span>
                      {conv.last_message_at && (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false, locale: ptBR })}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={cn(
                        "text-xs truncate",
                        conv.unread_count > 0 ? "text-foreground/80" : "text-muted-foreground"
                      )}>
                        {conv.last_message_is_from_me && "Você: "}
                        {conv.last_message || "Sem mensagens"}
                      </p>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {conv.lead && (
                          <div
                            className="h-2 w-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: conv.lead.lead_status?.color || 'hsl(var(--muted-foreground))' }}
                            title={conv.lead.lead_status?.name || 'Lead'}
                          />
                        )}
                        {conv.unread_count > 0 && (
                          <Badge className="h-5 min-w-[20px] px-1.5 text-[10px] bg-primary text-primary-foreground justify-center">
                            {conv.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
