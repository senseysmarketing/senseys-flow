

## Plano: Simplificar Botão WhatsApp para Acesso Direto

### Objetivo

Transformar o botão de WhatsApp em um "acesso rápido" que abre diretamente a conversa no WhatsApp do lead, sem exibir o popover de seleção de templates. O sistema de templates permanecerá apenas para envios automáticos.

### Mudanças Necessárias

#### Arquivo: `src/components/WhatsAppButton.tsx`

Simplificar o componente removendo:
- ❌ Estado de templates e popover
- ❌ Fetch de templates do banco
- ❌ Sistema de seleção de mensagem
- ❌ Componentes Popover, PopoverContent, PopoverTrigger

Manter apenas:
- ✅ Abertura direta do WhatsApp via `wa.me`
- ✅ Log da mensagem enviada (opcional, para histórico)
- ✅ Variantes visuais do botão (icon, outline, default)

### Código Simplificado

```typescript
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WhatsAppButtonProps {
  phone: string;
  className?: string;
  variant?: 'default' | 'icon' | 'outline';
  size?: 'sm' | 'default';
}

const WhatsAppButton = ({ 
  phone, 
  className,
  variant = 'default',
  size = 'sm'
}: WhatsAppButtonProps) => {
  
  const openWhatsApp = () => {
    const cleanPhone = phone.replace(/\D/g, '');
    // Adiciona 55 apenas se não começar com 55
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const whatsappUrl = `https://wa.me/${fullPhone}`;
    window.open(whatsappUrl, '_blank');
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
```

### Componentes que Usam WhatsAppButton

Os seguintes componentes passam props extras (leadName, leadId, etc.) que não serão mais necessárias:

| Componente | Local |
|------------|-------|
| `LeadKanbanCard.tsx` | Card no Kanban |
| `LeadMobileCard.tsx` | Card mobile |
| `LeadDetailModal.tsx` | Modal de detalhes |
| `LeadsTable.tsx` | Tabela de leads |

Esses componentes continuarão funcionando - as props extras serão ignoradas pelo novo componente simplificado.

### Resultado

| Antes | Depois |
|-------|--------|
| Clique abre popover com templates | Clique abre WhatsApp diretamente |
| Precisa selecionar mensagem | Acesso imediato à conversa |
| Busca templates do banco | Sem requisições extras |

### Fluxo

```text
Usuário clica no botão WhatsApp
        ↓
Formata número (adiciona 55 se necessário)
        ↓
Abre wa.me/{numero} em nova aba
        ↓
WhatsApp Web/App abre conversa
```

