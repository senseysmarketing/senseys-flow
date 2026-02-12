import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { WhatsAppChatModal } from '@/components/leads/WhatsAppChatModal';

interface WhatsAppButtonProps {
  phone: string;
  className?: string;
  variant?: 'default' | 'icon' | 'outline';
  size?: 'sm' | 'default';
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
  leadId,
  propertyName,
}: WhatsAppButtonProps) => {
  const [modalOpen, setModalOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setModalOpen(true);
  };

  const modal = (
    <WhatsAppChatModal
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      leadName={leadName || ''}
      leadId={leadId}
      phone={phone}
      propertyName={propertyName}
    />
  );

  if (variant === 'icon') {
    return (
      <>
        <Button 
          variant="ghost" 
          size="sm" 
          className={cn("h-8 w-8 p-0", className)}
          onClick={handleClick}
        >
          <MessageCircle className="h-4 w-4 text-green-500" />
        </Button>
        {modal}
      </>
    );
  }

  if (variant === 'outline') {
    return (
      <>
        <Button 
          variant="outline" 
          size={size}
          className={cn("gap-2", className)}
          onClick={handleClick}
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </Button>
        {modal}
      </>
    );
  }

  return (
    <>
      <Button 
        size="sm" 
        variant="outline" 
        className={cn(
          "w-full h-8 text-xs gap-2 hover:bg-success/10 hover:text-success hover:border-success/30 transition-colors",
          className
        )}
        onClick={handleClick}
      >
        <MessageCircle className="h-3.5 w-3.5" />
        WhatsApp
      </Button>
      {modal}
    </>
  );
};

export default WhatsAppButton;
