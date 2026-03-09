import { useState, useEffect } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/use-account";

interface QuickTemplatesPopoverProps {
  onSelect: (template: string) => void;
  leadName?: string;
  propertyName?: string;
}

export function QuickTemplatesPopover({ onSelect, leadName, propertyName }: QuickTemplatesPopoverProps) {
  const { account } = useAccount();
  const accountId = account?.id;
  const [templates, setTemplates] = useState<{ id: string; name: string; template: string }[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    supabase
      .from('whatsapp_templates')
      .select('id, name, template')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .order('position', { ascending: true })
      .then(({ data }) => setTemplates(data || []));
  }, [accountId]);

  const handleSelect = (template: string) => {
    // Replace variables
    let text = template;
    if (leadName) text = text.replace(/{nome}/g, leadName);
    if (account?.company_name) text = text.replace(/{empresa}/g, account.company_name);
    text = text.replace(/{nome}/g, 'Cliente');
    text = text.replace(/{empresa}/g, '');
    text = text.replace(/{email}/g, '');
    text = text.replace(/{telefone}/g, '');
    text = text.replacepropertyName || (/{imovel}/g, '');
    text = text.replace(/{corretor}/g, '');
    
    onSelect(text);
    setOpen(false);
  };

  if (templates.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 flex-shrink-0 rounded-xl" title="Templates rápidos">
          <FileText className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" side="top" align="start">
        <div className="p-3 border-b border-border">
          <p className="text-sm font-medium">Templates rápidos</p>
        </div>
        <ScrollArea className="max-h-60">
          <div className="p-1">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelect(t.template)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
              >
                <p className="text-sm font-medium truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{t.template}</p>
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
