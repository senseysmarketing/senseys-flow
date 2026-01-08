import { useState, useEffect } from 'react';
import { Bell, Mail, Volume2, Smartphone, Flame, Thermometer, Snowflake, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useNotificationPreferences } from '@/hooks/use-notification-preferences';
import { useAuth } from '@/hooks/use-auth';

export const NotificationSettings = () => {
  const { user } = useAuth();
  const { preferences, loading, saving, savePreferences } = useNotificationPreferences();
  const [localPrefs, setLocalPrefs] = useState(preferences);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');
  const [isPWA, setIsPWA] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    setLocalPrefs(preferences);
  }, [preferences]);

  useEffect(() => {
    // Check browser notification permission
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission);
    }

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

  const requestBrowserPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);
      if (permission === 'granted') {
        new Notification('Notificações Ativadas! 🎉', {
          body: 'Você receberá notificações de novos leads.',
          icon: '/pwa-192x192.png',
        });
      }
    }
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

      {/* Browser Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Notificações do Navegador</CardTitle>
              <CardDescription>
                Receba alertas em tempo real quando novos leads chegarem
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Notificações Push</Label>
              <p className="text-sm text-muted-foreground">
                {browserPermission === 'granted' 
                  ? 'Notificações ativadas' 
                  : browserPermission === 'denied'
                  ? 'Notificações bloqueadas no navegador'
                  : 'Clique para ativar notificações'}
              </p>
            </div>
            {browserPermission === 'granted' ? (
              <Badge variant="outline" className="border-green-500/30 text-green-600">Ativo</Badge>
            ) : browserPermission === 'denied' ? (
              <Badge variant="destructive">Bloqueado</Badge>
            ) : (
              <Button variant="outline" size="sm" onClick={requestBrowserPermission}>
                Ativar
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push_enabled">Push no dispositivo</Label>
              <p className="text-sm text-muted-foreground">
                Receber push notifications (requer app instalado)
              </p>
            </div>
            <Switch
              id="push_enabled"
              checked={localPrefs.push_enabled}
              onCheckedChange={(checked) => handleChange('push_enabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="sound_enabled">Som de notificação</Label>
                <p className="text-sm text-muted-foreground">
                  Tocar som quando novos leads chegarem
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
