import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useAccount } from '@/hooks/use-account';
import { toast } from 'sonner';

// OneSignal App ID
const ONESIGNAL_APP_ID = '2ed61f84-89ec-4384-9610-7e73ac8b2e47';

declare global {
  interface Window {
    OneSignalDeferred?: any[];
    OneSignal?: any;
  }
}

// Check if browser supports push notifications
const checkBrowserSupport = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) {
    console.warn('[OneSignal] Notifications not supported in this browser');
    return false;
  }
  if (!('serviceWorker' in navigator)) {
    console.warn('[OneSignal] Service workers not supported');
    return false;
  }
  return true;
};

export function useOneSignal() {
  const { user } = useAuth();
  const { account } = useAccount();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionState, setPermissionState] = useState<'default' | 'granted' | 'denied'>('default');
  const initAttemptedRef = useRef(false);

  // Refs to access current user/account during init
  const userRef = useRef(user);
  const accountRef = useRef(account);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    accountRef.current = account;
  }, [account]);

  // Initialize OneSignal
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (initAttemptedRef.current) return; // Prevent multiple init attempts
    
    // Check browser support first
    if (!checkBrowserSupport()) {
      setIsLoading(false);
      return;
    }

    initAttemptedRef.current = true;

    // Check if script already exists to prevent duplicates
    const existingScript = document.querySelector('script[src*="OneSignalSDK"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
      script.defer = true;
      document.head.appendChild(script);
      console.log('[OneSignal] SDK script added');
    } else {
      console.log('[OneSignal] SDK script already exists');
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal: any) {
      try {
        // Check if already initialized to avoid duplicate init errors
        const isAlreadyInitialized = window.OneSignal?.initialized === true;
        
        if (!isAlreadyInitialized) {
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
        } else {
          console.log('[OneSignal] Already initialized, skipping init');
        }

        setIsInitialized(true);

        // CRITICAL: If user is already authenticated, login immediately to identify them
        if (userRef.current) {
          await OneSignal.login(userRef.current.id);
          console.log('[OneSignal] Auto-login during init:', userRef.current.id);
          
          if (accountRef.current) {
            await OneSignal.User.addTags({
              account_id: accountRef.current.id,
              user_email: userRef.current.email || '',
            });
            console.log('[OneSignal] Tags added during init');
          }
        }

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
      } catch (error: any) {
        // Handle "already initialized" error gracefully
        if (error?.message?.includes('already initialized') || error?.message?.includes('init has already')) {
          console.log('[OneSignal] Already initialized (caught error)');
          setIsInitialized(true);
        } else {
          console.error('[OneSignal] Initialization error:', error);
        }
        setIsLoading(false);
      }
    });

    return () => {
      // Cleanup if needed
    };
  }, []);

  // Timeout to recover isInitialized if SDK is ready but state is not updated
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isInitialized && window.OneSignal) {
        console.warn('[OneSignal] Initialization timeout - recovering state');
        setIsInitialized(true);
        setIsLoading(false);
      }
    }, 5000); // 5 seconds timeout

    return () => clearTimeout(timeout);
  }, [isInitialized]);

  // Re-login when user changes (e.g., after auth state change)
  useEffect(() => {
    if (!isInitialized || !user || !account) return;

    window.OneSignalDeferred?.push(async function(OneSignal: any) {
      try {
        // Always login when user/account changes to ensure external_id is set
        await OneSignal.login(user.id);
        console.log('[OneSignal] User logged in on auth change:', user.id);

        // Add/update tags for targeting
        await OneSignal.User.addTags({
          account_id: account.id,
          user_email: user.email || '',
        });
        console.log('[OneSignal] Tags updated for account:', account.id);
      } catch (error) {
        console.error('[OneSignal] Login error:', error);
      }
    });
  }, [isInitialized, user, account]);

  const subscribe = useCallback(async () => {
    // Try to recover if isInitialized is false but SDK is actually ready
    if (!isInitialized && window.OneSignal) {
      console.log('[OneSignal] Recovering initialization state');
      setIsInitialized(true);
    }

    // Final check - if still not initialized and SDK not ready
    if (!isInitialized && !window.OneSignal) {
      toast.error('OneSignal ainda não foi inicializado. Recarregue a página.');
      return false;
    }

    try {
      setIsLoading(true);

      await new Promise<void>((resolve, reject) => {
        window.OneSignalDeferred?.push(async function(OneSignal: any) {
          try {
            // FORCE RESET: Logout first to clear any previous binding
            try {
              await OneSignal.logout();
              console.log('[OneSignal] Logged out to reset identity');
            } catch (e) {
              console.log('[OneSignal] Logout skipped (not logged in)');
            }

            // CRITICAL: Login FIRST to identify the user BEFORE requesting permission
            // This ensures the external_id is linked to the subscription
            if (user) {
              await OneSignal.login(user.id);
              console.log('[OneSignal] User logged in BEFORE permission request:', user.id);
            }

            // Request permission
            await OneSignal.Notifications.requestPermission();
            
            const permission = await OneSignal.Notifications.permission;
            setPermissionState(permission ? 'granted' : 'denied');

            if (permission) {
              // Opt-in to push notifications
              await OneSignal.User.PushSubscription.optIn();
              console.log('[OneSignal] User opted in to push notifications');
              
              // Re-login after opt-in to ensure binding
              if (user) {
                await OneSignal.login(user.id);
                console.log('[OneSignal] Re-login after opt-in:', user.id);
              }
              
              // Add tags for targeting
              if (account) {
                await OneSignal.User.addTags({
                  account_id: account.id,
                  user_email: user?.email || '',
                });
                console.log('[OneSignal] Tags added after subscription');
              }
              
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
  }, [isInitialized, user, account]);

  const unsubscribe = useCallback(async () => {
    if (!isInitialized && !window.OneSignal) return false;

    try {
      setIsLoading(true);

      await new Promise<void>((resolve, reject) => {
        window.OneSignalDeferred?.push(async function(OneSignal: any) {
          try {
            await OneSignal.User.PushSubscription.optOut();
            // Also logout to clear the external_id binding
            await OneSignal.logout();
            console.log('[OneSignal] User logged out and unsubscribed');
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
