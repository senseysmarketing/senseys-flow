import { useState, useEffect } from 'react';
import { MessageCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

interface WhatsAppTemplate {
  id: string;
  name: string;
  template: string;
  position: number;
}

interface WhatsAppMessagePopoverProps {
  phone: string;
  leadName: string;
  interesse?: string;
  children: React.ReactNode;
}

const WhatsAppMessagePopover = ({ phone, leadName, interesse, children }: WhatsAppMessagePopoverProps) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      fetchTemplates();
    }
  }, [user, isOpen]);

  const fetchTemplates = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('whatsapp_templates')
      .select('id, name, template, position')
      .eq('is_active', true)
      .order('position');

    setTemplates(data || []);
  };

  const replaceVariables = (template: string) => {
    return template
      .replace(/\{nome\}/g, leadName)
      .replace(/\{interesse\}/g, interesse || '');
  };

  const sendMessage = (message: string) => {
    const formattedMessage = replaceVariables(message);
    const whatsappUrl = `https://wa.me/55${phone.replace(/\D/g, '')}?text=${encodeURIComponent(formattedMessage)}`;
    window.open(whatsappUrl, '_blank');
    setIsOpen(false);
  };

  const defaultMessage = `Olá {nome}! Recebi seu cadastro com interesse no(a) {interesse}. Como posso te ajudar?`;

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
                {replaceVariables(defaultMessage).length > 30 
                  ? `${replaceVariables(defaultMessage).substring(0, 30)}...` 
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
              onClick={() => sendMessage(template.template)}
            >
              <div className="text-left">
                <div className="font-medium text-sm">{template.name}</div>
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  {replaceVariables(template.template).length > 30 
                    ? `${replaceVariables(template.template).substring(0, 30)}...` 
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
                // Navigate to settings (this will be handled by parent)
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