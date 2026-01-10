import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useAccount } from '@/hooks/use-account';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Firebase configuration
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAfzJpXN9DHeAL_-a-_nWX7xIm64UmDix8",
  authDomain: "crm-senseys-web.firebaseapp.com",
  projectId: "crm-senseys-web",
  storageBucket: "crm-senseys-web.firebasestorage.app",
  messagingSenderId: "974602486500",
  appId: "1:974602486500:web:6a7b7a6e18cf4291c1a2f1"
};

const VAPID_KEY = "BKE0RBcL1IKtevJFchHffx-3DZkp3rxF7Nh0_yqPyqDVpBGibITJzoA67mx-4Y36Oab-kEi83Mni_950hQEF2NE";

export interface FCMDiagnosticInfo {
  fcmToken: string | null;
  userId: string | null;
  isIOS: boolean;
  isPWA: boolean;
  serviceWorkerStatus: 'loading' | 'active' | 'error' | 'unsupported';
  lastUpdated: Date | null;
}

const checkIsIOS = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const checkIsPWA = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || 
    (window.navigator as any).standalone === true;
};

const checkBrowserSupport = (): boolean => {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && 'serviceWorker' in navigator;
};

// Load Firebase SDK dynamically from CDN
const loadFirebaseSDK = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ((window as any).firebase) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js';
    script.onload = () => {
      const msgScript = document.createElement('script');
      msgScript.src = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js';
      msgScript.onload = () => resolve();
      msgScript.onerror = () => reject(new Error('Failed to load Firebase Messaging'));
      document.head.appendChild(msgScript);
    };
    script.onerror = () => reject(new Error('Failed to load Firebase App'));
    document.head.appendChild(script);
  });
};

interface FirebaseMessagingContextType {
  isInitialized: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permissionState: 'default' | 'granted' | 'denied';
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  sendTestNotification: () => Promise<void>;
  diagnosticInfo: FCMDiagnosticInfo;
  diagnosticLogs: string[];
  getDiagnosticInfo: () => Promise<void>;
  addDiagnosticLog: (message: string) => void;
  cleanupOldTokens: () => Promise<{ deleted: number; error?: string }>;
}

const FirebaseMessagingContext = createContext<FirebaseMessagingContextType | null>(null);

export function FirebaseMessagingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { account } = useAccount();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionState, setPermissionState] = useState<'default' | 'granted' | 'denied'>('default');
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const initAttemptedRef = useRef(false);

  const [diagnosticInfo, setDiagnosticInfo] = useState<FCMDiagnosticInfo>({
    fcmToken: null,
    userId: null,
    isIOS: checkIsIOS(),
    isPWA: checkIsPWA(),
    serviceWorkerStatus: 'loading',
    lastUpdated: null
  });
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);

  const addDiagnosticLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    console.log(`[FCM] ${message}`);
    setDiagnosticLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
  }, []);

  const updateDiagnosticInfo = useCallback((updates: Partial<FCMDiagnosticInfo>) => {
    setDiagnosticInfo(prev => ({ ...prev, ...updates, lastUpdated: new Date() }));
  }, []);

  // Save FCM token to database - UPSERT to avoid duplicates
  const saveTokenToDatabase = useCallback(async (token: string, userId: string, accountId: string) => {
    try {
      addDiagnosticLog('Desativando tokens antigos...');
      
      // First, deactivate ALL old tokens for this user (ensures only 1 active)
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('user_id', userId);
      
      addDiagnosticLog('Salvando novo token...');
      
      // Check if this exact token already exists
      const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('endpoint', token)
        .eq('user_id', userId)
        .single();

      if (existing) {
        // Reactivate existing token
        await supabase
          .from('push_subscriptions')
          .update({ 
            is_active: true, 
            device_name: navigator.userAgent.substring(0, 50),
            account_id: accountId
          })
          .eq('id', existing.id);
      } else {
        // Insert new token
        await supabase.from('push_subscriptions').insert({
          user_id: userId,
          account_id: accountId,
          endpoint: token,
          p256dh: 'fcm',
          auth: 'fcm',
          is_active: true,
          device_name: navigator.userAgent.substring(0, 50)
        });
      }
      addDiagnosticLog('Token salvo com sucesso (único ativo)');
      return true;
    } catch (error: any) {
      addDiagnosticLog(`ERRO ao salvar: ${error.message}`);
      return false;
    }
  }, [addDiagnosticLog]);

  // Initialize on mount and auto-reconnect FCM if needed
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!user?.id || !account?.id) {
      setIsLoading(false);
      return;
    }
    if (initAttemptedRef.current) return;
    if (!checkBrowserSupport()) {
      setIsLoading(false);
      updateDiagnosticInfo({ serviceWorkerStatus: 'unsupported' });
      return;
    }

    initAttemptedRef.current = true;

    const init = async () => {
      try {
        addDiagnosticLog('Inicializando FCM Provider...');
        setPermissionState(Notification.permission as 'default' | 'granted' | 'denied');
        
        if (Notification.permission === 'granted') {
          // Check for existing valid FCM token (not old Web Push tokens)
          const { data: existing } = await supabase
            .from('push_subscriptions')
            .select('endpoint, is_active')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .not('endpoint', 'like', 'https://%') // Exclude old Web Push tokens
            .single();
          
          if (existing && existing.endpoint) {
            addDiagnosticLog('Token FCM válido encontrado, reconectando...');
            
            // Auto-reconnect: load Firebase SDK and setup listeners
            try {
              await loadFirebaseSDK();
              const firebase = (window as any).firebase;
              
              if (!firebase.apps.length) {
                firebase.initializeApp(FIREBASE_CONFIG);
              }
              
              // Register service worker
              const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
              await navigator.serviceWorker.ready;
              
              const messaging = firebase.messaging();
              
              // Setup foreground message listener
              messaging.onMessage((payload: any) => {
                console.log('[FCM] Foreground message:', payload);
                addDiagnosticLog(`Mensagem recebida: ${payload.notification?.title}`);
                if (payload.notification) {
                  toast(payload.notification.title, {
                    description: payload.notification.body,
                  });
                }
              });
              
              setIsSubscribed(true);
              setFcmToken(existing.endpoint);
              updateDiagnosticInfo({ fcmToken: existing.endpoint, userId: user.id, serviceWorkerStatus: 'active' });
              addDiagnosticLog('FCM reconectado com sucesso');
            } catch (reconnectError: any) {
              addDiagnosticLog(`AVISO: Falha ao reconectar FCM: ${reconnectError.message}`);
              // Still mark as subscribed since token exists in DB
              setIsSubscribed(true);
              setFcmToken(existing.endpoint);
              updateDiagnosticInfo({ fcmToken: existing.endpoint, userId: user.id });
            }
          } else {
            addDiagnosticLog('Nenhum token FCM válido encontrado');
          }
        }
        
        setIsInitialized(true);
        updateDiagnosticInfo({ serviceWorkerStatus: 'active' });
      } catch (error: any) {
        addDiagnosticLog(`ERRO: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [user?.id, account?.id, addDiagnosticLog, updateDiagnosticInfo]);

  // Reset state on logout
  useEffect(() => {
    if (!user?.id) {
      initAttemptedRef.current = false;
      setIsSubscribed(false);
      setFcmToken(null);
      setIsInitialized(false);
      setIsLoading(true);
    }
  }, [user?.id]);

  const subscribe = useCallback(async () => {
    if (!user?.id || !account?.id) {
      toast.error('Você precisa estar logado');
      return false;
    }

    try {
      setIsLoading(true);
      addDiagnosticLog('Iniciando subscribe...');

      // Load Firebase SDK from CDN
      await loadFirebaseSDK();
      addDiagnosticLog('Firebase SDK carregado');

      const firebase = (window as any).firebase;

      // Initialize Firebase if not already
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
        addDiagnosticLog('Firebase inicializado');
      }

      // Register service worker with forced update
      const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { 
        scope: '/',
        updateViaCache: 'none' // Force fetch latest version
      });
      
      // Force SW update if available
      if (swReg.waiting) {
        swReg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      await swReg.update();
      await navigator.serviceWorker.ready;
      addDiagnosticLog('Service Worker registrado (atualizado)');

      // Request permission
      const permission = await Notification.requestPermission();
      setPermissionState(permission as 'default' | 'granted' | 'denied');
      addDiagnosticLog(`Permissão: ${permission}`);

      if (permission !== 'granted') {
        toast.error('Permissão negada');
        return false;
      }

      // Get messaging instance and token
      const messaging = firebase.messaging();
      
      const token = await messaging.getToken({ 
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swReg 
      });

      if (!token) throw new Error('Não foi possível obter token');
      
      addDiagnosticLog(`Token obtido: ${token.substring(0, 20)}...`);
      setFcmToken(token);

      await saveTokenToDatabase(token, user.id, account.id);

      // Listen for foreground messages
      messaging.onMessage((payload: any) => {
        console.log('[FCM] Foreground message:', payload);
        addDiagnosticLog(`Mensagem recebida: ${payload.notification?.title}`);
        if (payload.notification) {
          toast(payload.notification.title, {
            description: payload.notification.body,
          });
        }
      });

      setIsSubscribed(true);
      updateDiagnosticInfo({ fcmToken: token, userId: user.id });
      toast.success('Push notifications ativadas!');
      return true;
    } catch (error: any) {
      addDiagnosticLog(`ERRO: ${error.message}`);
      toast.error('Erro ao ativar notificações');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, account, saveTokenToDatabase, addDiagnosticLog, updateDiagnosticInfo]);

  const unsubscribe = useCallback(async () => {
    try {
      setIsLoading(true);
      if (fcmToken) {
        await supabase.from('push_subscriptions').update({ is_active: false }).eq('endpoint', fcmToken);
      }
      setIsSubscribed(false);
      setFcmToken(null);
      updateDiagnosticInfo({ fcmToken: null });
      toast.success('Push notifications desativadas');
      return true;
    } catch (error: any) {
      toast.error('Erro ao desativar');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fcmToken, updateDiagnosticInfo]);

  const sendTestNotification = useCallback(async () => {
    if (!isSubscribed || !user) {
      toast.error('Ative as notificações primeiro');
      return;
    }
    try {
      addDiagnosticLog('Enviando teste...');
      const { data, error } = await supabase.functions.invoke('send-fcm-notification', {
        body: {
          user_ids: [user.id],
          title: '🧪 Teste de Notificação',
          body: 'FCM está funcionando!',
          url: '/settings'
        }
      });
      if (error) throw error;
      
      // Log FCM response
      addDiagnosticLog(`Resposta FCM: sent=${data?.sent || 0}, failed=${data?.failed || 0}`);
      toast.success(`Notificação enviada! (${data?.sent || 0} dispositivo${data?.sent !== 1 ? 's' : ''})`);
    } catch (error: any) {
      addDiagnosticLog(`ERRO: ${error.message}`);
      toast.error('Erro ao enviar teste');
    }
  }, [isSubscribed, user, addDiagnosticLog]);

  const getDiagnosticInfo = useCallback(async () => {
    updateDiagnosticInfo({ isIOS: checkIsIOS(), isPWA: checkIsPWA(), userId: user?.id || null });
    addDiagnosticLog('Diagnóstico atualizado');
  }, [user?.id, addDiagnosticLog, updateDiagnosticInfo]);

  // Cleanup old Web Push tokens (OneSignal, etc.)
  const cleanupOldTokens = useCallback(async () => {
    if (!user?.id) return { deleted: 0 };
    
    try {
      addDiagnosticLog('Limpando tokens antigos...');
      
      const { data: oldTokens, error: fetchError } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint')
        .eq('user_id', user.id)
        .like('endpoint', 'https://%'); // Old Web Push tokens start with https://
      
      if (fetchError) throw fetchError;
      
      if (!oldTokens || oldTokens.length === 0) {
        addDiagnosticLog('Nenhum token antigo encontrado');
        return { deleted: 0 };
      }
      
      const { error: deleteError } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .like('endpoint', 'https://%');
      
      if (deleteError) throw deleteError;
      
      addDiagnosticLog(`${oldTokens.length} token(s) antigo(s) removido(s)`);
      toast.success(`${oldTokens.length} token(s) antigo(s) removido(s)`);
      return { deleted: oldTokens.length };
    } catch (error: any) {
      addDiagnosticLog(`ERRO ao limpar: ${error.message}`);
      toast.error('Erro ao limpar tokens antigos');
      return { deleted: 0, error: error.message };
    }
  }, [user?.id, addDiagnosticLog]);

  const value: FirebaseMessagingContextType = {
    isInitialized,
    isSubscribed,
    isLoading,
    permissionState,
    subscribe,
    unsubscribe,
    sendTestNotification,
    diagnosticInfo,
    diagnosticLogs,
    getDiagnosticInfo,
    addDiagnosticLog,
    cleanupOldTokens
  };

  return (
    <FirebaseMessagingContext.Provider value={value}>
      {children}
    </FirebaseMessagingContext.Provider>
  );
}

export function useFirebaseMessaging() {
  const context = useContext(FirebaseMessagingContext);
  if (!context) {
    throw new Error('useFirebaseMessaging must be used within a FirebaseMessagingProvider');
  }
  return context;
}
