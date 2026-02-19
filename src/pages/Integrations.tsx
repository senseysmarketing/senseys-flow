import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Webhook, Building2, MessageCircle, Plug } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { WebhookSettings } from "@/components/WebhookSettings";
import { OlxIntegrationSettings } from "@/components/OlxIntegrationSettings";
import { WhatsAppIntegrationSettings } from "@/components/whatsapp/WhatsAppIntegrationSettings";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

type TabValue = 'webhook' | 'olx' | 'whatsapp';

const Integrations = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const [accountId, setAccountId] = useState("");

  const initialTab = useMemo(() => {
    const param = searchParams.get('tab');
    const valid: TabValue[] = ['webhook', 'olx', 'whatsapp'];
    return valid.includes(param as TabValue) ? (param as TabValue) : 'webhook';
  }, []);

  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("account_id")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => { if (data) setAccountId(data.account_id); });
  }, [user]);

  const tabs = [
    { value: 'webhook' as TabValue, label: 'Webhook', icon: <Webhook className="h-4 w-4" /> },
    { value: 'olx' as TabValue, label: 'Grupo OLX', icon: <Building2 className="h-4 w-4" /> },
    { value: 'whatsapp' as TabValue, label: 'WhatsApp', icon: <MessageCircle className="h-4 w-4" /> },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'webhook': return <WebhookSettings />;
      case 'olx': return <OlxIntegrationSettings accountId={accountId} />;
      case 'whatsapp': return <WhatsAppIntegrationSettings />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Plug className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrações</h1>
          <p className="text-muted-foreground">Gerencie as conexões com portais e plataformas externas</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
        <TabsList className={cn("flex flex-wrap h-auto gap-1 bg-muted p-1", isMobile && "w-full")}>
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={cn("gap-2", isMobile && "text-xs px-2 py-1.5")}
            >
              {tab.icon}
              <span className={isMobile ? "truncate" : ""}>{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="max-w-4xl">
        {renderContent()}
      </div>
    </div>
  );
};

export default Integrations;
