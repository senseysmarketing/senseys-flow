import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Settings,
  Palette,
  Shuffle,
  Target,
  Bell,
  Upload,
  ChevronRight,
  Send,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { exportLeadsToExcel } from "./LeadsExport";
import { usePermissions } from "@/hooks/use-permissions";
import { useIsMobile } from "@/hooks/use-mobile";
import LeadStatusManager from "./LeadStatusManager";
import DistributionRulesManager from "@/components/DistributionRulesManager";
import MetaFormScoringManager from "@/components/MetaFormScoringManager";
import FollowUpSettings from "@/components/FollowUpSettings";
import DataImporter from "@/components/DataImporter";
import MetaEventMappingManager from "@/components/MetaEventMappingManager";

type SettingsTab = "status" | "distribution" | "qualification" | "followup" | "import" | "meta-events" | "export";

interface LeadsSettingsSheetProps {
  children?: React.ReactNode;
  onOpenTab?: (tab: SettingsTab) => void;
  filteredLeads?: any[];
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
    id: "import" as SettingsTab,
    icon: Upload,
    label: "Importar Leads",
    description: "Importe leads de planilhas ou outras fontes",
    permission: "leads.create",
  },
  {
    id: "meta-events" as SettingsTab,
    icon: Send,
    label: "Eventos Meta CAPI",
    description: "Configure o disparo de eventos para otimização de campanhas",
  },
  {
    id: "export" as SettingsTab,
    icon: Download,
    label: "Exportar Leads",
    description: "Exporte os leads filtrados em planilha Excel (.xlsx)",
  },
];

const modalConfig: Record<SettingsTab, { title: string; description: string; maxWidth: string }> = {
  status: {
    title: "Status dos Leads",
    description: "Personalize os status do funil de vendas",
    maxWidth: "!max-w-2xl",
  },
  distribution: {
    title: "Regras de Distribuição",
    description: "Configure como leads são atribuídos aos corretores",
    maxWidth: "!max-w-3xl",
  },
  qualification: {
    title: "Qualificação Automática",
    description: "Defina regras para qualificar leads automaticamente",
    maxWidth: "!max-w-4xl",
  },
  followup: {
    title: "Follow-up Automático",
    description: "Configure lembretes e alertas de follow-up",
    maxWidth: "!max-w-2xl",
  },
  import: {
    title: "Importar Leads",
    description: "Importe leads de planilhas ou outras fontes",
    maxWidth: "!max-w-4xl",
  },
  "meta-events": {
    title: "Eventos Meta CAPI",
    description: "Configure eventos de conversão enviados ao Meta",
    maxWidth: "!max-w-5xl",
  },
};

export const LeadsSettingsSheet = ({ children, onOpenTab, filteredLeads }: LeadsSettingsSheetProps) => {
  const [open, setOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<SettingsTab | null>(null);
  const { hasPermission } = usePermissions();
  const isMobile = useIsMobile();

  const handleItemClick = (tab: SettingsTab) => {
    if (tab === "export") {
      setOpen(false);
      if (!filteredLeads || filteredLeads.length === 0) {
        toast.error("Nenhum lead para exportar");
        return;
      }
      exportLeadsToExcel(filteredLeads);
      toast.success(`${filteredLeads.length} leads exportados com sucesso`);
      return;
    }
    setOpen(false);
    setTimeout(() => setActiveModal(tab), 150);
  };

  const visibleItems = settingsItems.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

  const renderModalContent = (tab: SettingsTab) => {
    switch (tab) {
      case "status":
        return <LeadStatusManager />;
      case "distribution":
        return <DistributionRulesManager />;
      case "qualification":
        return <MetaFormScoringManager />;
      case "followup":
        return <FollowUpSettings />;
      case "import":
        return <DataImporter />;
      case "meta-events":
        return <MetaEventMappingManager />;
      default:
        return null;
    }
  };

  const currentConfig = activeModal ? modalConfig[activeModal] : null;

  return (
    <>
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

      {/* Settings Modals */}
      <Dialog open={!!activeModal} onOpenChange={(isOpen) => !isOpen && setActiveModal(null)}>
        {currentConfig && (
          <DialogContent className={`${currentConfig.maxWidth} max-h-[85vh] overflow-y-auto`}>
            <DialogHeader>
              <DialogTitle>{currentConfig.title}</DialogTitle>
              <DialogDescription>{currentConfig.description}</DialogDescription>
            </DialogHeader>
            {activeModal && renderModalContent(activeModal)}
          </DialogContent>
        )}
      </Dialog>
    </>
  );
};
