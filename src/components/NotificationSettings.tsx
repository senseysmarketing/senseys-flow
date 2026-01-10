import { useState, useEffect } from 'react';
import { Bell, Mail, Volume2, Smartphone, Flame, Thermometer, Snowflake, Download, Send, Loader2, CheckCircle2, XCircle, Bug, RefreshCw, Copy, AlertTriangle, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotificationPreferences } from '@/hooks/use-notification-preferences';
import { useAuth } from '@/hooks/use-auth';
import { useFirebaseMessaging } from '@/hooks/use-firebase-messaging';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Helper component for diagnostic info rows
const DiagnosticRow = ({ 
  label, 
  value, 
  status,
  critical 
}: { 
  label: string; 
  value: string | null | undefined;
  status: 'success' | 'error' | 'warning' | 'info';
  critical?: boolean;
}) => {
  const statusColors = {
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-orange-500',
    info: 'text-muted-foreground'
  };

  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(value);
      toast.success('Copiado!');
    }
  };

  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
      <span className={cn("text-xs", critical && "font-semibold")}>{label}</span>
      <div className="flex items-center gap-1">
        <span className={cn(
          statusColors[status], 
          "text-xs truncate max-w-[160px] font-mono"
        )}>
          {value || 'null'}
        </span>
        {value && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-5 w-5 shrink-0"
            onClick={handleCopy}
          >
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
};

export const NotificationSettings = () => {
  const { user } = useAuth();
  const { preferences, loading, saving, savePreferences } = useNotificationPreferences();
  const { 
    isInitialized: isPushSupported, 
    isSubscribed: isPushSubscribed, 
    isLoading: isPushLoading,
    permissionState,
    subscribe: subscribeToPush, 
    unsubscribe: unsubscribeFromPush,
    sendTestNotification,
    diagnosticInfo,
    diagnosticLogs,
    getDiagnosticInfo,
    cleanupOldTokens
  } = useFirebaseMessaging();
  
  const [localPrefs, setLocalPrefs] = useState(preferences);
  const [isPWA, setIsPWA] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    setLocalPrefs(preferences);
  }, [preferences]);

  useEffect(() => {
    // Check if running as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsPWA(isStandalone);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleChange = (key: string, value: boolean | string) => {
    setLocalPrefs(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    savePreferences(localPrefs);
  };

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  const hasChanges = JSON.stringify(localPrefs) !== JSON.stringify(preferences);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* PWA Install Card */}
      {!isPWA && (
        <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Instalar App no Celular</CardTitle>
                <CardDescription>
                  Instale o CRM como um app para receber notificações push
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {deferredPrompt ? (
              <Button onClick={handleInstallPWA} className="gap-2">
                <Download className="h-4 w-4" />
                Instalar Agora
              </Button>
            ) : (
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">Para instalar no seu dispositivo:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>iPhone/iPad:</strong> Toque em Compartilhar → "Adicionar à Tela de Início"</li>
                  <li><strong>Android:</strong> Menu do navegador → "Instalar app" ou "Adicionar à tela inicial"</li>
                  <li><strong>Desktop:</strong> Clique no ícone de instalação na barra de endereço</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isPWA && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-green-600">
              <Smartphone className="h-5 w-5" />
              <span className="font-medium">App instalado com sucesso!</span>
              <Badge variant="outline" className="border-green-500/30 text-green-600">PWA</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Firebase Push Notifications */}
      <Card className="border-primary/30">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Send className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Push Notifications</CardTitle>
              <CardDescription>
                Receba notificações em tempo real no celular e computador
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Status do dispositivo</Label>
              <p className="text-sm text-muted-foreground">
                {isPushSubscribed 
                  ? 'Este dispositivo está recebendo notificações push'
                  : 'Ative para receber notificações push neste dispositivo'}
              </p>
            </div>
            {isPushLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : isPushSubscribed ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-green-500/30 text-green-600 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Ativo
                </Badge>
              </div>
            ) : permissionState === 'denied' ? (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                Bloqueado
              </Badge>
            ) : null}
          </div>

          <div className="flex gap-2">
            {isPushSubscribed ? (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={unsubscribeFromPush}
                  disabled={isPushLoading}
                >
                  Desativar Push
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={sendTestNotification}
                  disabled={isPushLoading}
                  className="gap-1"
                >
                  <Send className="h-3 w-3" />
                  Testar
                </Button>
              </>
            ) : permissionState === 'denied' ? (
              <p className="text-sm text-muted-foreground">
                As notificações foram bloqueadas. Para reativar, acesse as configurações do navegador.
              </p>
            ) : (
              <Button 
                onClick={subscribeToPush}
                disabled={isPushLoading}
                className="gap-2"
              >
                {isPushLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
                Ativar Push neste Dispositivo
              </Button>
            )}
          </div>

          <Separator />

          {/* Sound Notification Option */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="sound_enabled">Som de notificação</Label>
                <p className="text-sm text-muted-foreground">
                  Tocar som quando novos leads chegarem (app aberto)
                </p>
              </div>
            </div>
            <Switch
              id="sound_enabled"
              checked={localPrefs.sound_enabled}
              onCheckedChange={(checked) => handleChange('sound_enabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Firebase Diagnostic Panel */}
      <Card className="border-orange-500/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Bug className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Diagnóstico Firebase</CardTitle>
                <CardDescription>
                  Informações técnicas para debug
                </CardDescription>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => getDiagnosticInfo()}
              className="gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Critical alert if no token but subscribed */}
          {diagnosticInfo.fcmToken === null && isPushSubscribed && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <strong className="text-red-600">Problema detectado!</strong>
                <p className="text-muted-foreground mt-1">
                  Token FCM não encontrado. Notificações não serão recebidas. 
                  Tente desativar e reativar o push.
                </p>
              </div>
            </div>
          )}

          {/* iOS not in PWA mode alert */}
          {diagnosticInfo.isIOS && !diagnosticInfo.isPWA && (
            <div className="flex items-start gap-2 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <strong className="text-orange-600">Push no iPhone/iPad</strong>
                <p className="text-muted-foreground mt-1 mb-2">
                  Para receber notificações neste dispositivo, você precisa:
                </p>
                <ol className="text-muted-foreground list-decimal list-inside space-y-1 text-xs">
                  <li>Tocar no ícone de <strong>Compartilhar</strong> (⬆️) do Safari</li>
                  <li>Selecionar <strong>"Adicionar à Tela de Início"</strong></li>
                  <li>Abrir o app pelo ícone criado na tela inicial</li>
                  <li>Voltar aqui e ativar as notificações</li>
                </ol>
              </div>
            </div>
          )}
          
          {/* Diagnostic info table */}
          <div className="space-y-0.5 bg-muted/30 rounded-lg p-3">
            <DiagnosticRow 
              label="Dispositivo iOS" 
              value={diagnosticInfo.isIOS ? 'Sim' : 'Não'} 
              status="info"
            />
            <DiagnosticRow 
              label="Modo PWA (Tela Início)" 
              value={diagnosticInfo.isPWA ? 'Sim' : 'Não'} 
              status={diagnosticInfo.isPWA ? 'success' : (diagnosticInfo.isIOS ? 'error' : 'info')}
              critical={diagnosticInfo.isIOS}
            />
            <DiagnosticRow 
              label="User ID (Supabase)" 
              value={user?.id} 
              status="info"
            />
            <DiagnosticRow 
              label="FCM Token" 
              value={diagnosticInfo.fcmToken ? `...${diagnosticInfo.fcmToken.slice(-20)}` : null} 
              status={diagnosticInfo.fcmToken ? 'success' : 'warning'}
              critical
            />
            <DiagnosticRow 
              label="Service Worker" 
              value={diagnosticInfo.serviceWorkerStatus} 
              status={diagnosticInfo.serviceWorkerStatus === 'active' ? 'success' : 
                      diagnosticInfo.serviceWorkerStatus === 'error' ? 'error' : 'warning'}
            />
            <DiagnosticRow 
              label="Permissão" 
              value={permissionState} 
              status={permissionState === 'granted' ? 'success' : permissionState === 'denied' ? 'error' : 'warning'}
            />
            <DiagnosticRow 
              label="Inscrito" 
              value={isPushSubscribed ? 'Sim' : 'Não'} 
              status={isPushSubscribed ? 'success' : 'warning'}
            />
            {diagnosticInfo.lastUpdated && (
              <DiagnosticRow 
                label="Última atualização" 
                value={diagnosticInfo.lastUpdated.toLocaleTimeString('pt-BR')} 
                status="info"
              />
            )}
          </div>

          <Separator />

          {/* Cleanup old tokens */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-sm">Limpar tokens antigos</Label>
              <p className="text-xs text-muted-foreground">
                Remove tokens de sistemas antigos (OneSignal, Web Push)
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => cleanupOldTokens()}
              className="gap-1 text-orange-600 border-orange-500/30 hover:bg-orange-500/10"
            >
              <Trash2 className="h-3 w-3" />
              Limpar
            </Button>
          </div>

          <Separator />

          {/* Real-time logs */}
          <div>
            <Label className="text-sm font-medium">Logs em Tempo Real</Label>
            <ScrollArea className="h-32 mt-2 rounded border bg-muted/50 p-2">
              {diagnosticLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum log ainda. Interaja com as notificações para ver os logs.
                </p>
              ) : (
                <div className="space-y-1 font-mono text-xs">
                  {diagnosticLogs.map((log, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "text-muted-foreground",
                        log.includes('ERRO') && "text-red-500",
                        log.includes('AVISO') && "text-orange-500",
                        log.includes('sucesso') && "text-green-600"
                      )}
                    >
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Notificações por Email</CardTitle>
              <CardDescription>
                Receba emails quando novos leads forem adicionados
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email_enabled">Ativar notificações por email</Label>
              <p className="text-sm text-muted-foreground">
                Receber emails sobre novos leads
              </p>
            </div>
            <Switch
              id="email_enabled"
              checked={localPrefs.email_enabled}
              onCheckedChange={(checked) => handleChange('email_enabled', checked)}
            />
          </div>

          {localPrefs.email_enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="notify_email">Email para notificações</Label>
                <Input
                  id="notify_email"
                  type="email"
                  placeholder={user?.email || "seu@email.com"}
                  value={localPrefs.notify_email || ''}
                  onChange={(e) => handleChange('notify_email', e.target.value)}
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Receber email para leads:</Label>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-red-500" />
                    <span className="text-sm">Leads Quentes</span>
                  </div>
                  <Switch
                    checked={localPrefs.email_for_hot}
                    onCheckedChange={(checked) => handleChange('email_for_hot', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">Leads Mornos</span>
                  </div>
                  <Switch
                    checked={localPrefs.email_for_warm}
                    onCheckedChange={(checked) => handleChange('email_for_warm', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Snowflake className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Leads Frios</span>
                  </div>
                  <Switch
                    checked={localPrefs.email_for_cold}
                    onCheckedChange={(checked) => handleChange('email_for_cold', checked)}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      {hasChanges && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Preferências'}
          </Button>
        </div>
      )}
    </div>
  );
};
