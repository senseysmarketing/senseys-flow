import { useState, useEffect, useCallback } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useAccount } from '@/hooks/use-account';

interface WhatsAppTemplate {
  id: string;
  name: string;
  template: string;
  position: number;
}

interface WhatsAppMessagePopoverProps {
  phone: string;
  leadName: string;
  leadId?: string;
  propertyName?: string;
  interesse?: string;
  children: React.ReactNode;
}

const WhatsAppMessagePopover = ({ 
  phone, 
  leadName, 
  leadId,
  propertyName,
  interesse, 
  children 
}: WhatsAppMessagePopoverProps) => {
  const { user } = useAuth();
  const { account } = useAccount();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasLoadedTemplates, setHasLoadedTemplates] = useState(false);
  
  const accountId = account?.id;

  // Fetch templates on mount to know if we should show popover or go direct
  useEffect(() => {
    if (user) {
      fetchTemplates();
    }
  }, [user]);

  const fetchTemplates = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('whatsapp_templates')
      .select('id, name, template, position')
      .eq('is_active', true)
      .order('position');

    setTemplates(data || []);
    setHasLoadedTemplates(true);
  };

  const replaceVariables = (template: string) => {
    const firstName = leadName.split(' ')[0];
    // Use propertyName if available, otherwise fallback to interesse
    const propertyDisplay = propertyName || interesse || '';
    
    return template
      .replace(/\{nome\}/g, leadName)
      .replace(/\{primeiro_nome\}/g, firstName)
      .replace(/\{imovel\}/g, propertyDisplay)
      .replace(/\{interesse\}/g, propertyDisplay); // Keep for backwards compatibility
  };

  const logMessage = async (message: string, templateId?: string) => {
    if (!leadId || !user || !accountId) return;
    
    try {
      await supabase.from('whatsapp_message_log').insert({
        lead_id: leadId,
        template_id: templateId || null,
        message_content: message,
        sent_by: user.id,
        account_id: accountId
      });
    } catch (error) {
      console.error('Error logging WhatsApp message:', error);
    }
  };

  const sendMessage = useCallback((message: string, templateId?: string) => {
    const formattedMessage = replaceVariables(message);
    const whatsappUrl = `https://wa.me/55${phone.replace(/\D/g, '')}?text=${encodeURIComponent(formattedMessage)}`;
    window.open(whatsappUrl, '_blank');
    setIsOpen(false);
    
    // Log the message
    logMessage(formattedMessage, templateId);
  }, [phone, leadName, propertyName, interesse, leadId, user, accountId]);

  const defaultMessage = `Olá {nome}! Recebi seu cadastro com interesse no(a) {imovel}. Como posso te ajudar?`;

  // Handle click on trigger - if no custom templates, go directly to WhatsApp
  const handleTriggerClick = (e: React.MouseEvent) => {
    if (hasLoadedTemplates && templates.length === 0) {
      e.preventDefault();
      e.stopPropagation();
      sendMessage(defaultMessage);
    }
    // Otherwise, let the popover open normally
  };

  // If no custom templates, render children with direct click handler
  if (hasLoadedTemplates && templates.length === 0) {
    return (
      <div className="w-full" onClick={handleTriggerClick}>
        {children}
      </div>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <div className="p-4 border-b">
          <h4 className="font-medium text-sm">Enviar mensagem via WhatsApp</h4>
          <p className="text-xs text-muted-foreground mt-1">Escolha um modelo de mensagem</p>
        </div>
        
        <div className="p-2 space-y-1">
          {/* Default message */}
          <Button
            variant="ghost"
            className="w-full justify-start h-auto p-3"
            onClick={() => sendMessage(defaultMessage)}
          >
            <div className="text-left">
              <div className="font-medium text-sm">Mensagem Padrão</div>
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {replaceVariables(defaultMessage).length > 50 
                  ? `${replaceVariables(defaultMessage).substring(0, 50)}...` 
                  : replaceVariables(defaultMessage)}
              </div>
            </div>
          </Button>

          {/* Custom templates */}
          {templates.map((template) => (
            <Button
              key={template.id}
              variant="ghost"
              className="w-full justify-start h-auto p-3"
              onClick={() => sendMessage(template.template, template.id)}
            >
              <div className="text-left">
                <div className="font-medium text-sm">{template.name}</div>
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  {replaceVariables(template.template).length > 50 
                    ? `${replaceVariables(template.template).substring(0, 50)}...` 
                    : replaceVariables(template.template)}
                </div>
              </div>
            </Button>
          ))}
        </div>

        {templates.length < 3 && (
          <div className="p-3 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                setIsOpen(false);
                window.location.href = '/settings';
              }}
            >
              <Settings className="h-3 w-3 mr-2" />
              Configurar mensagens
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default WhatsAppMessagePopover;
