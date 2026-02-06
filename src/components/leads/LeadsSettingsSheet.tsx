import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Settings,
  Palette,
  Shuffle,
  Target,
  Bell,
  MessageCircle,
  Upload,
  ChevronRight,
} from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { useIsMobile } from "@/hooks/use-mobile";

type SettingsTab = "status" | "distribution" | "qualification" | "followup" | "whatsapp" | "import";

interface LeadsSettingsSheetProps {
  children?: React.ReactNode;
  onOpenTab?: (tab: SettingsTab) => void;
}

const settingsItems = [
  {
    id: "status" as SettingsTab,
    icon: Palette,
    label: "Status dos Leads",
    description: "Personalize os status do funil de vendas",
  },
  {
    id: "distribution" as SettingsTab,
    icon: Shuffle,
    label: "Regras de Distribuição",
    description: "Configure como leads são atribuídos aos corretores",
  },
  {
    id: "qualification" as SettingsTab,
    icon: Target,
    label: "Qualificação Automática",
    description: "Defina regras para qualificar leads automaticamente",
  },
  {
    id: "followup" as SettingsTab,
    icon: Bell,
    label: "Follow-up Automático",
    description: "Configure lembretes e alertas de follow-up",
  },
  {
    id: "whatsapp" as SettingsTab,
    icon: MessageCircle,
    label: "Templates WhatsApp",
    description: "Crie mensagens prontas para contato via WhatsApp",
  },
  {
    id: "import" as SettingsTab,
    icon: Upload,
    label: "Importar Leads",
    description: "Importe leads de planilhas ou outras fontes",
    permission: "leads.create",
  },
];

export const LeadsSettingsSheet = ({ children, onOpenTab }: LeadsSettingsSheetProps) => {
  const [open, setOpen] = useState(false);
  const { hasPermission } = usePermissions();
  const isMobile = useIsMobile();

  const handleItemClick = (tab: SettingsTab) => {
    setOpen(false);
    // Navigate to settings page with the specific tab
    window.location.href = `/settings?tab=${tab}`;
  };

  const visibleItems = settingsItems.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children || (
          <Button variant="outline" size="icon" className="h-9 w-9">
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "h-[85vh]" : ""}>
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Configurações de Leads
          </SheetTitle>
          <SheetDescription>
            Personalize o gerenciamento de leads do seu CRM
          </SheetDescription>
        </SheetHeader>

        <Separator className="my-4" />

        <ScrollArea className="h-[calc(100%-120px)]">
          <div className="space-y-2 pr-4">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-muted/50 transition-colors text-left group"
                >
                  <div className="flex-shrink-0 p-2.5 rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">{item.label}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
