import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WhatsAppButtonProps {
  phone: string;
  className?: string;
  variant?: 'default' | 'icon' | 'outline';
  size?: 'sm' | 'default';
  // Props mantidas para compatibilidade (ignoradas)
  leadName?: string;
  leadId?: string;
  propertyName?: string;
  interesse?: string;
}

const WhatsAppButton = ({ 
  phone, 
  className,
  variant = 'default',
  size = 'sm',
  leadName,
  propertyName,
}: WhatsAppButtonProps) => {
  
  const openWhatsApp = () => {
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    
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

  if (variant === 'icon') {
    return (
      <Button 
        variant="ghost" 
        size="sm" 
        className={cn("h-8 w-8 p-0", className)}
        onClick={openWhatsApp}
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
        onClick={openWhatsApp}
      >
        <MessageCircle className="h-4 w-4" />
        WhatsApp
      </Button>
    );
  }

  return (
    <Button 
      size="sm" 
      variant="outline" 
      className={cn(
        "w-full h-8 text-xs gap-2 hover:bg-success/10 hover:text-success hover:border-success/30 transition-colors",
        className
      )}
      onClick={openWhatsApp}
    >
      <MessageCircle className="h-3.5 w-3.5" />
      WhatsApp
    </Button>
  );
};

export default WhatsAppButton;
