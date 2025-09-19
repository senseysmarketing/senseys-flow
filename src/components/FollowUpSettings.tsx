import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Settings, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface FollowUpSettingsProps {
  onSettingsChange?: (settings: FollowUpSettingsType) => void;
}

export interface FollowUpSettingsType {
  enabled: boolean;
  intervalMinutes: number;
  daysThreshold: number;
  showUrgentOnly: boolean;
}

const FollowUpSettings = ({ onSettingsChange }: FollowUpSettingsProps) => {
  const [settings, setSettings] = useState<FollowUpSettingsType>({
    enabled: true,
    intervalMinutes: 120, // 2 horas
    daysThreshold: 7,
    showUrgentOnly: false
  });

  // Carregar configurações salvas
  useEffect(() => {
    const savedSettings = localStorage.getItem('followup-settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);
      onSettingsChange?.(parsed);
    }
  }, [onSettingsChange]);

  const updateSettings = (newSettings: Partial<FollowUpSettingsType>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem('followup-settings', JSON.stringify(updated));
    onSettingsChange?.(updated);
    
    toast({
      title: "✅ Configurações salvas",
      description: "As configurações de follow-up foram atualizadas",
    });
  };

  const intervalOptions = [
    { value: 30, label: "30 minutos" },
    { value: 60, label: "1 hora" },
    { value: 120, label: "2 horas" },
    { value: 240, label: "4 horas" },
    { value: 480, label: "8 horas" },
    { value: 1440, label: "1 dia" },
  ];

  const thresholdOptions = [
    { value: 3, label: "3 dias" },
    { value: 5, label: "5 dias" },
    { value: 7, label: "7 dias" },
    { value: 10, label: "10 dias" },
    { value: 14, label: "14 dias" },
  ];

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          <CardTitle>Configurações de Follow-up</CardTitle>
        </div>
        <CardDescription>
          Configure lembretes automáticos para leads antigos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Ativar/Desativar */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Lembretes Automáticos</Label>
            <div className="text-sm text-muted-foreground">
              Receber notificações sobre leads antigos
            </div>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(enabled) => updateSettings({ enabled })}
          />
        </div>

        {settings.enabled && (
          <>
            {/* Intervalo de Notificações */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Frequência dos Lembretes
              </Label>
              <Select 
                value={settings.intervalMinutes.toString()} 
                onValueChange={(value) => updateSettings({ intervalMinutes: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {intervalOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Threshold de Dias */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Considerar Lead "Antigo" após
              </Label>
              <Select 
                value={settings.daysThreshold.toString()} 
                onValueChange={(value) => updateSettings({ daysThreshold: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {thresholdOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Apenas Urgentes */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Apenas Leads Urgentes</Label>
                <div className="text-xs text-muted-foreground">
                  Notificar apenas leads há mais de 14 dias
                </div>
              </div>
              <Switch
                checked={settings.showUrgentOnly}
                onCheckedChange={(showUrgentOnly) => updateSettings({ showUrgentOnly })}
              />
            </div>
          </>
        )}

        {/* Resumo das Configurações */}
        <div className="pt-4 border-t">
          <div className="text-sm text-muted-foreground space-y-1">
            {settings.enabled ? (
              <>
                <div>✅ Lembretes ativos</div>
                <div>⏰ A cada {intervalOptions.find(o => o.value === settings.intervalMinutes)?.label}</div>
                <div>📅 Para leads há mais de {settings.daysThreshold} dias</div>
                {settings.showUrgentOnly && <div>🚨 Apenas leads urgentes</div>}
              </>
            ) : (
              <div>❌ Lembretes desativados</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FollowUpSettings;