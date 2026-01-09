import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useAccount } from '@/hooks/use-account';
import { toast } from 'sonner';

// VAPID Public Key - must match the one in Supabase secrets
const VAPID_PUBLIC_KEY = 'BNZkAiL3Z_X-9oWOTIfechltOH23-Sy9iD9D-Hf8348qHWfUVh0l5gKZ1QpuYsq05hyshEYZ125uMMlp2wm0oHU';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS Device';
  if (/Android/.test(ua)) return 'Android Device';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown Device';
}

export function usePushSubscription() {
  const { user } = useAuth();
  const { account } = useAccount();
  const accountId = account?.id;
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');

  // Check if push is supported
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    
    if ('Notification' in window) {
      setPermissionState(Notification.permission);
    }
  }, []);

  // Register service worker and check subscription status
  useEffect(() => {
    if (!isSupported || !user) {
      setIsLoading(false);
      return;
    }

    const checkSubscription = async () => {
      try {
        // Register service worker
        const registration = await navigator.serviceWorker.register('/sw-push.js');
        console.log('[Push] Service worker registered:', registration);

        // Wait for service worker to be ready
        const sw = await navigator.serviceWorker.ready;
        
        // Check existing subscription
        const existingSubscription = await sw.pushManager.getSubscription();
        
        if (existingSubscription) {
          setSubscription(existingSubscription);
          
          // Verify subscription exists in database
          const { data } = await supabase
            .from('push_subscriptions')
            .select('id')
            .eq('user_id', user.id)
            .eq('endpoint', existingSubscription.endpoint)
            .maybeSingle();
          
          setIsSubscribed(!!data);
        } else {
          setIsSubscribed(false);
        }
      } catch (error) {
        console.error('[Push] Error checking subscription:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSubscription();
  }, [isSupported, user]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !user || !accountId) {
      toast.error('Push notifications não são suportadas neste navegador');
      return false;
    }

    try {
      setIsLoading(true);

      // Request notification permission
      const permission = await Notification.requestPermission();
      setPermissionState(permission);
      
      if (permission !== 'granted') {
        toast.error('Permissão para notificações foi negada');
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer
      });

      console.log('[Push] New subscription:', newSubscription);

      // Extract keys from subscription
      const subscriptionJson = newSubscription.toJSON();
      const p256dh = subscriptionJson.keys?.p256dh || '';
      const auth = subscriptionJson.keys?.auth || '';

      if (!accountId) {
        toast.error('Conta não encontrada');
        return false;
      }

      // Save subscription to database
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          account_id: accountId,
          endpoint: newSubscription.endpoint,
          p256dh,
          auth,
          device_name: getDeviceName(),
          is_active: true
        }, {
          onConflict: 'user_id,endpoint'
        });

      if (error) {
        console.error('[Push] Error saving subscription:', error);
        throw error;
      }

      setSubscription(newSubscription);
      setIsSubscribed(true);
      toast.success('Push notifications ativadas!');
      return true;
    } catch (error) {
      console.error('[Push] Error subscribing:', error);
      toast.error('Erro ao ativar push notifications');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user, accountId]);

  const unsubscribe = useCallback(async () => {
    if (!subscription || !user) return false;

    try {
      setIsLoading(true);

      // Unsubscribe from push
      await subscription.unsubscribe();

      // Remove from database
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('endpoint', subscription.endpoint);

      if (error) {
        console.error('[Push] Error removing subscription:', error);
      }

      setSubscription(null);
      setIsSubscribed(false);
      toast.success('Push notifications desativadas');
      return true;
    } catch (error) {
      console.error('[Push] Error unsubscribing:', error);
      toast.error('Erro ao desativar push notifications');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [subscription, user]);

  const sendTestNotification = useCallback(async () => {
    if (!isSubscribed) {
      toast.error('Ative as notificações push primeiro');
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: user?.id,
          title: '🧪 Teste de Notificação',
          body: 'Se você está vendo isso, push notifications estão funcionando!',
          url: '/settings'
        }
      });

      if (error) throw error;
      toast.success('Notificação de teste enviada!');
    } catch (error) {
      console.error('[Push] Error sending test:', error);
      toast.error('Erro ao enviar notificação de teste');
    }
  }, [isSubscribed, user]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permissionState,
    subscribe,
    unsubscribe,
    sendTestNotification
  };
}
