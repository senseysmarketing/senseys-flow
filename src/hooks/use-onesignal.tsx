import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useAccount } from '@/hooks/use-account';
import { toast } from 'sonner';

// OneSignal App ID - will be loaded from window
const ONESIGNAL_APP_ID = '0c8c8f50-34a5-4f19-9a3e-f59a5d24ffca';

declare global {
  interface Window {
    OneSignalDeferred?: any[];
    OneSignal?: any;
  }
}

export function useOneSignal() {
  const { user } = useAuth();
  const { account } = useAccount();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionState, setPermissionState] = useState<'default' | 'granted' | 'denied'>('default');

  // Initialize OneSignal
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Load OneSignal SDK
    const script = document.createElement('script');
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.defer = true;
    document.head.appendChild(script);

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal: any) {
      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerParam: { scope: '/' },
          serviceWorkerPath: '/OneSignalSDKWorker.js',
          notifyButton: {
            enable: false, // We'll use our own UI
          },
        });

        console.log('[OneSignal] Initialized successfully');
        setIsInitialized(true);

        // Check current permission state
        const permission = await OneSignal.Notifications.permission;
        setPermissionState(permission ? 'granted' : 'default');

        // Check if subscribed
        const isPushEnabled = await OneSignal.User.PushSubscription.optedIn;
        setIsSubscribed(isPushEnabled);

        // Listen for subscription changes
        OneSignal.User.PushSubscription.addEventListener('change', (event: any) => {
          console.log('[OneSignal] Subscription changed:', event);
          setIsSubscribed(event.current.optedIn);
        });

        setIsLoading(false);
      } catch (error) {
        console.error('[OneSignal] Initialization error:', error);
        setIsLoading(false);
      }
    });

    return () => {
      // Cleanup if needed
    };
  }, []);

  // Login user when authenticated
  useEffect(() => {
    if (!isInitialized || !user || !account) return;

    window.OneSignalDeferred?.push(async function(OneSignal: any) {
      try {
        // Login with external user ID (Supabase user.id)
        await OneSignal.login(user.id);
        console.log('[OneSignal] User logged in:', user.id);

        // Add tags for targeting
        await OneSignal.User.addTags({
          account_id: account.id,
          user_email: user.email || '',
        });
        console.log('[OneSignal] Tags added for account:', account.id);
      } catch (error) {
        console.error('[OneSignal] Login error:', error);
      }
    });
  }, [isInitialized, user, account]);

  const subscribe = useCallback(async () => {
    if (!isInitialized) {
      toast.error('OneSignal ainda não foi inicializado');
      return false;
    }

    try {
      setIsLoading(true);

      await new Promise<void>((resolve, reject) => {
        window.OneSignalDeferred?.push(async function(OneSignal: any) {
          try {
            // Request permission and opt-in
            await OneSignal.Notifications.requestPermission();
            
            const permission = await OneSignal.Notifications.permission;
            setPermissionState(permission ? 'granted' : 'denied');

            if (permission) {
              await OneSignal.User.PushSubscription.optIn();
              setIsSubscribed(true);
              toast.success('Push notifications ativadas!');
              resolve();
            } else {
              toast.error('Permissão para notificações foi negada');
              reject(new Error('Permission denied'));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      return true;
    } catch (error) {
      console.error('[OneSignal] Subscribe error:', error);
      toast.error('Erro ao ativar push notifications');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized]);

  const unsubscribe = useCallback(async () => {
    if (!isInitialized) return false;

    try {
      setIsLoading(true);

      await new Promise<void>((resolve, reject) => {
        window.OneSignalDeferred?.push(async function(OneSignal: any) {
          try {
            await OneSignal.User.PushSubscription.optOut();
            setIsSubscribed(false);
            toast.success('Push notifications desativadas');
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });

      return true;
    } catch (error) {
      console.error('[OneSignal] Unsubscribe error:', error);
      toast.error('Erro ao desativar push notifications');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized]);

  const sendTestNotification = useCallback(async () => {
    if (!isSubscribed || !user) {
      toast.error('Ative as notificações push primeiro');
      return;
    }

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { error } = await supabase.functions.invoke('send-onesignal-notification', {
        body: {
          user_ids: [user.id],
          title: '🧪 Teste de Notificação',
          body: 'Se você está vendo isso, OneSignal está funcionando!',
          url: '/settings'
        }
      });

      if (error) throw error;
      toast.success('Notificação de teste enviada!');
    } catch (error) {
      console.error('[OneSignal] Test notification error:', error);
      toast.error('Erro ao enviar notificação de teste');
    }
  }, [isSubscribed, user]);

  return {
    isInitialized,
    isSubscribed,
    isLoading,
    permissionState,
    subscribe,
    unsubscribe,
    sendTestNotification
  };
}
