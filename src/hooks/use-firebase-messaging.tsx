import { useEffect, useState, useCallback, useRef } from 'react';
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

export function useFirebaseMessaging() {
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

  // Save FCM token to database
  const saveTokenToDatabase = useCallback(async (token: string, userId: string, accountId: string) => {
    try {
      addDiagnosticLog('Salvando token no banco...');
      const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('endpoint', token)
        .eq('user_id', userId)
        .single();

      if (existing) {
        await supabase
          .from('push_subscriptions')
          .update({ is_active: true, device_name: navigator.userAgent.substring(0, 50) })
          .eq('id', existing.id);
      } else {
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
      addDiagnosticLog('Token salvo com sucesso');
      return true;
    } catch (error: any) {
      addDiagnosticLog(`ERRO ao salvar: ${error.message}`);
      return false;
    }
  }, [addDiagnosticLog]);

  // Initialize on mount
  useEffect(() => {
    if (typeof window === 'undefined' || initAttemptedRef.current) return;
    if (!checkBrowserSupport()) {
      setIsLoading(false);
      updateDiagnosticInfo({ serviceWorkerStatus: 'unsupported' });
      return;
    }

    initAttemptedRef.current = true;

    const init = async () => {
      try {
        addDiagnosticLog('Inicializando...');
        setPermissionState(Notification.permission as 'default' | 'granted' | 'denied');
        
        if (Notification.permission === 'granted' && user?.id) {
          const { data: existing } = await supabase
            .from('push_subscriptions')
            .select('endpoint, is_active')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single();
          
          if (existing) {
            setIsSubscribed(true);
            setFcmToken(existing.endpoint);
            updateDiagnosticInfo({ fcmToken: existing.endpoint, userId: user.id });
            addDiagnosticLog('Token existente encontrado');
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
  }, [user?.id, addDiagnosticLog, updateDiagnosticInfo]);

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

      // Register service worker
      const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      addDiagnosticLog('Service Worker registrado');

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
      messaging.useServiceWorker(swReg);
      
      const token = await messaging.getToken({ vapidKey: VAPID_KEY });

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
      const { error } = await supabase.functions.invoke('send-fcm-notification', {
        body: {
          user_ids: [user.id],
          title: '🧪 Teste de Notificação',
          body: 'FCM está funcionando!',
          url: '/settings'
        }
      });
      if (error) throw error;
      toast.success('Notificação enviada!');
    } catch (error: any) {
      addDiagnosticLog(`ERRO: ${error.message}`);
      toast.error('Erro ao enviar teste');
    }
  }, [isSubscribed, user, addDiagnosticLog]);

  const getDiagnosticInfo = useCallback(async () => {
    updateDiagnosticInfo({ isIOS: checkIsIOS(), isPWA: checkIsPWA(), userId: user?.id || null });
    addDiagnosticLog('Diagnóstico atualizado');
  }, [user?.id, addDiagnosticLog, updateDiagnosticInfo]);

  return {
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
    addDiagnosticLog
  };
}
