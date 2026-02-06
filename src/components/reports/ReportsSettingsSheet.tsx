import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Send } from "lucide-react";
import MetaEventMappingManager from "@/components/MetaEventMappingManager";

interface ReportsSettingsSheetProps {
  trigger?: React.ReactNode;
}

export function ReportsSettingsSheet({ trigger }: ReportsSettingsSheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Configurações de Relatórios</SheetTitle>
          <SheetDescription>
            Configure integrações e mapeamentos de eventos
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <Tabs defaultValue="events" className="w-full">
            <TabsList className="grid w-full grid-cols-1">
              <TabsTrigger value="events" className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Eventos Meta CAPI
              </TabsTrigger>
            </TabsList>

            <TabsContent value="events" className="mt-4">
              <MetaEventMappingManager />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
