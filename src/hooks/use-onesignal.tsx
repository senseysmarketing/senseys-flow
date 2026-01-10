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

// Diagnostic info type
export interface OneSignalDiagnosticInfo {
  externalId: string | null;
  onesignalId: string | null;
  subscriptionId: string | null;
  pushToken: string | null;
  sdkVersion: string | null;
  lastUpdated: Date | null;
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

  // Diagnostic state
  const [diagnosticInfo, setDiagnosticInfo] = useState<OneSignalDiagnosticInfo>({
    externalId: null,
    onesignalId: null,
    subscriptionId: null,
    pushToken: null,
    sdkVersion: null,
    lastUpdated: null
  });
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);

  // Add a diagnostic log entry
  const addDiagnosticLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    console.log(`[OneSignal] ${message}`);
    setDiagnosticLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
  }, []);

  // Get diagnostic info from OneSignal
  const getDiagnosticInfo = useCallback(async (): Promise<OneSignalDiagnosticInfo> => {
    return new Promise((resolve) => {
      if (!window.OneSignal) {
        const info: OneSignalDiagnosticInfo = {
          externalId: null,
          onesignalId: null,
          subscriptionId: null,
          pushToken: null,
          sdkVersion: null,
          lastUpdated: new Date()
        };
        setDiagnosticInfo(info);
        addDiagnosticLog('SDK não disponível');
        resolve(info);
        return;
      }

      window.OneSignalDeferred?.push(async function(OneSignal: any) {
        try {
          const info: OneSignalDiagnosticInfo = {
            externalId: OneSignal.User?.externalId || null,
            onesignalId: OneSignal.User?.onesignalId || null,
            subscriptionId: OneSignal.User?.PushSubscription?.id || null,
            pushToken: OneSignal.User?.PushSubscription?.token || null,
            sdkVersion: OneSignal.VERSION || null,
            lastUpdated: new Date()
          };
          setDiagnosticInfo(info);
          addDiagnosticLog(`Diagnóstico: externalId=${info.externalId}, subscriptionId=${info.subscriptionId?.slice(0, 8) || 'null'}`);
          resolve(info);
        } catch (error: any) {
          addDiagnosticLog(`Erro ao obter diagnóstico: ${error.message}`);
          resolve({
            externalId: null,
            onesignalId: null,
            subscriptionId: null,
            pushToken: null,
            sdkVersion: null,
            lastUpdated: new Date()
          });
        }
      });
    });
  }, [addDiagnosticLog]);

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
        addDiagnosticLog('Iniciando SDK...');
        
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
          addDiagnosticLog('SDK inicializado com sucesso');
        } else {
          addDiagnosticLog('SDK já estava inicializado');
        }

        setIsInitialized(true);

        // CRITICAL: If user is already authenticated, login immediately to identify them
        if (userRef.current) {
          addDiagnosticLog(`Fazendo login com user.id: ${userRef.current.id}`);
          await OneSignal.login(userRef.current.id);
          addDiagnosticLog('Login realizado durante init');
          
          if (accountRef.current) {
            await OneSignal.User.addTags({
              account_id: accountRef.current.id,
              user_email: userRef.current.email || '',
            });
            addDiagnosticLog(`Tags adicionadas: account_id=${accountRef.current.id}`);
          }
        } else {
          addDiagnosticLog('Usuário não autenticado durante init');
        }

        // Check current permission state
        const permission = await OneSignal.Notifications.permission;
        setPermissionState(permission ? 'granted' : 'default');
        addDiagnosticLog(`Permissão: ${permission ? 'granted' : 'default'}`);

        // Check if subscribed
        const isPushEnabled = await OneSignal.User.PushSubscription.optedIn;
        setIsSubscribed(isPushEnabled);
        addDiagnosticLog(`Inscrito: ${isPushEnabled ? 'Sim' : 'Não'}`);

        // Listen for subscription changes
        OneSignal.User.PushSubscription.addEventListener('change', (event: any) => {
          addDiagnosticLog(`Subscription mudou: optedIn=${event.current.optedIn}`);
          setIsSubscribed(event.current.optedIn);
        });

        setIsLoading(false);
        
        // Get initial diagnostic info
        setTimeout(() => getDiagnosticInfo(), 1000);
      } catch (error: any) {
        // Handle "already initialized" error gracefully
        if (error?.message?.includes('already initialized') || error?.message?.includes('init has already')) {
          addDiagnosticLog('SDK já inicializado (erro tratado)');
          setIsInitialized(true);
        } else {
          addDiagnosticLog(`Erro na inicialização: ${error.message}`);
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
    addDiagnosticLog('Iniciando subscribe...');
    
    // Try to recover if isInitialized is false but SDK is actually ready
    if (!isInitialized && window.OneSignal) {
      addDiagnosticLog('Recuperando estado de inicialização');
      setIsInitialized(true);
    }

    // Final check - if still not initialized and SDK not ready
    if (!isInitialized && !window.OneSignal) {
      addDiagnosticLog('ERRO: SDK não disponível');
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
              addDiagnosticLog('Logout realizado para reset');
            } catch (e) {
              addDiagnosticLog('Logout ignorado (não logado)');
            }

            // CRITICAL: Login FIRST to identify the user BEFORE requesting permission
            // This ensures the external_id is linked to the subscription
            if (user) {
              addDiagnosticLog(`Fazendo login com user.id: ${user.id}`);
              await OneSignal.login(user.id);
              addDiagnosticLog('Login realizado ANTES da permissão');
            } else {
              addDiagnosticLog('AVISO: Nenhum usuário autenticado');
            }

            // Request permission
            addDiagnosticLog('Solicitando permissão...');
            await OneSignal.Notifications.requestPermission();
            
            const permission = await OneSignal.Notifications.permission;
            setPermissionState(permission ? 'granted' : 'denied');
            addDiagnosticLog(`Permissão: ${permission ? 'granted' : 'denied'}`);

            if (permission) {
              // Opt-in to push notifications
              addDiagnosticLog('Fazendo opt-in...');
              await OneSignal.User.PushSubscription.optIn();
              addDiagnosticLog('Opt-in realizado');
              
              // Re-login after opt-in to ensure binding
              if (user) {
                addDiagnosticLog('Re-login após opt-in...');
                await OneSignal.login(user.id);
                addDiagnosticLog('Re-login realizado');
              }
              
              // Add tags for targeting
              if (account) {
                await OneSignal.User.addTags({
                  account_id: account.id,
                  user_email: user?.email || '',
                });
                addDiagnosticLog(`Tags adicionadas: account_id=${account.id}`);
              }
              
              setIsSubscribed(true);
              
              // Update diagnostic info after subscribe
              setTimeout(() => getDiagnosticInfo(), 500);
              
              toast.success('Push notifications ativadas!');
              resolve();
            } else {
              addDiagnosticLog('ERRO: Permissão negada');
              toast.error('Permissão para notificações foi negada');
              reject(new Error('Permission denied'));
            }
          } catch (error: any) {
            addDiagnosticLog(`ERRO: ${error.message}`);
            reject(error);
          }
        });
      });

      return true;
    } catch (error: any) {
      addDiagnosticLog(`ERRO no subscribe: ${error.message}`);
      console.error('[OneSignal] Subscribe error:', error);
      toast.error('Erro ao ativar push notifications');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, user, account, addDiagnosticLog, getDiagnosticInfo]);

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
    sendTestNotification,
    // Diagnostic exports
    diagnosticInfo,
    diagnosticLogs,
    getDiagnosticInfo,
    addDiagnosticLog
  };
}
