import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useAccount } from '@/hooks/use-account';
import { cn } from '@/lib/utils';

interface WhatsAppTemplate {
  id: string;
  name: string;
  template: string;
  position: number;
}

interface WhatsAppButtonProps {
  phone: string;
  leadName: string;
  leadId?: string;
  propertyName?: string;
  interesse?: string;
  className?: string;
  variant?: 'default' | 'icon' | 'outline';
  size?: 'sm' | 'default';
}

const WhatsAppButton = ({ 
  phone, 
  leadName, 
  leadId,
  propertyName,
  interesse,
  className,
  variant = 'default',
  size = 'sm'
}: WhatsAppButtonProps) => {
  const { user } = useAuth();
  const { account } = useAccount();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasLoadedTemplates, setHasLoadedTemplates] = useState(false);
  
  const accountId = account?.id;

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
    const propertyDisplay = propertyName || interesse || '';
    
    return template
      .replace(/\{nome\}/g, leadName)
      .replace(/\{primeiro_nome\}/g, firstName)
      .replace(/\{imovel\}/g, propertyDisplay)
      .replace(/\{interesse\}/g, propertyDisplay);
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
    logMessage(formattedMessage, templateId);
  }, [phone, leadName, propertyName, interesse, leadId, user, accountId]);

  const defaultMessage = `Olá {nome}! Recebi seu cadastro com interesse no(a) {imovel}. Como posso te ajudar?`;

  const handleDirectClick = () => {
    sendMessage(defaultMessage);
  };

  // Render the button element based on variant
  const renderButton = (onClick?: () => void) => {
    if (variant === 'icon') {
      return (
        <Button 
          variant="ghost" 
          size="sm" 
          className={cn("h-8 w-8 p-0", className)}
          onClick={onClick}
        >
          <MessageCircle className="h-4 w-4 text-green-500" />
        </Button>
      );
    }

    if (variant === 'outline') {
      return (
        <Button 
          variant="outline" 
          size={size}
          className={cn("gap-2", className)}
          onClick={onClick}
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </Button>
      );
    }

    // Default variant - full width with hover effects
    return (
      <Button 
        size="sm" 
        variant="outline" 
        className={cn(
          "w-full h-8 text-xs gap-2 hover:bg-success/10 hover:text-success hover:border-success/30 transition-colors",
          className
        )}
        onClick={onClick}
      >
        <MessageCircle className="h-3.5 w-3.5" />
        WhatsApp
      </Button>
    );
  };

  // If no custom templates loaded yet or no templates exist, render button with direct click
  if (hasLoadedTemplates && templates.length === 0) {
    return renderButton(handleDirectClick);
  }

  // With templates: show popover
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {renderButton()}
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

export default WhatsAppButton;
