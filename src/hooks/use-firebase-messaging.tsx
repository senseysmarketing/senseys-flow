import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useAccount } from '@/hooks/use-account';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Firebase configuration from your Firebase console
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAfzJpXN9DHeAL_-a-_nWX7xIm64UmDix8",
  authDomain: "crm-senseys-web.firebaseapp.com",
  projectId: "crm-senseys-web",
  storageBucket: "crm-senseys-web.firebasestorage.app",
  messagingSenderId: "974602486500",
  appId: "1:974602486500:web:6a7b7a6e18cf4291c1a2f1"
};

// VAPID key for web push
const VAPID_KEY = "BKE0RBcL1IKtevJFchHffx-3DZkp3rxF7Nh0_yqPyqDVpBGibITJzoA67mx-4Y36Oab-kEi83Mni_950hQEF2NE";

// Diagnostic info type
export interface FCMDiagnosticInfo {
  fcmToken: string | null;
  userId: string | null;
  isIOS: boolean;
  isPWA: boolean;
  serviceWorkerStatus: 'loading' | 'active' | 'error' | 'unsupported';
  lastUpdated: Date | null;
}

// Check if iOS device
const checkIsIOS = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Check if running as PWA (standalone mode)
const checkIsPWA = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || 
    (window.navigator as any).standalone === true;
};

// Check if browser supports push notifications
const checkBrowserSupport = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) {
    console.warn('[FCM] Notifications not supported in this browser');
    return false;
  }
  if (!('serviceWorker' in navigator)) {
    console.warn('[FCM] Service workers not supported');
    return false;
  }
  return true;
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

  // Diagnostic state
  const [diagnosticInfo, setDiagnosticInfo] = useState<FCMDiagnosticInfo>({
    fcmToken: null,
    userId: null,
    isIOS: checkIsIOS(),
    isPWA: checkIsPWA(),
    serviceWorkerStatus: 'loading',
    lastUpdated: null
  });
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);

  // Firebase SDK references
  const firebaseAppRef = useRef<any>(null);
  const messagingRef = useRef<any>(null);

  // Add a diagnostic log entry
  const addDiagnosticLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    console.log(`[FCM] ${message}`);
    setDiagnosticLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
  }, []);

  // Update diagnostic info
  const updateDiagnosticInfo = useCallback((updates: Partial<FCMDiagnosticInfo>) => {
    setDiagnosticInfo(prev => ({
      ...prev,
      ...updates,
      lastUpdated: new Date()
    }));
  }, []);

  // Load Firebase SDK dynamically
  const loadFirebaseSDK = useCallback(async () => {
    if (firebaseAppRef.current) return { app: firebaseAppRef.current, messaging: messagingRef.current };
    
    addDiagnosticLog('Carregando Firebase SDK...');
    
    try {
      // Import Firebase modules
      const { initializeApp, getApps, getApp } = await import('firebase/app');
      const { getMessaging, getToken, onMessage, isSupported } = await import('firebase/messaging');

      // Check if messaging is supported
      const supported = await isSupported();
      if (!supported) {
        addDiagnosticLog('ERRO: Firebase Messaging não suportado neste navegador');
        updateDiagnosticInfo({ serviceWorkerStatus: 'unsupported' });
        return null;
      }

      // Initialize Firebase app
      let app;
      if (getApps().length === 0) {
        app = initializeApp(FIREBASE_CONFIG);
        addDiagnosticLog('Firebase App inicializado');
      } else {
        app = getApp();
        addDiagnosticLog('Firebase App já existente');
      }
      
      firebaseAppRef.current = app;

      // Get messaging instance
      const messaging = getMessaging(app);
      messagingRef.current = messaging;
      addDiagnosticLog('Firebase Messaging inicializado');

      // Listen for foreground messages
      onMessage(messaging, (payload) => {
        console.log('[FCM] Foreground message received:', payload);
        addDiagnosticLog(`Mensagem recebida: ${payload.notification?.title}`);
        
        // Show toast notification for foreground messages
        if (payload.notification) {
          toast(payload.notification.title, {
            description: payload.notification.body,
          });
        }
      });

      return { app, messaging, getToken };
    } catch (error: any) {
      addDiagnosticLog(`ERRO ao carregar Firebase: ${error.message}`);
      console.error('[FCM] Error loading Firebase:', error);
      return null;
    }
  }, [addDiagnosticLog, updateDiagnosticInfo]);

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    try {
      addDiagnosticLog('Registrando Service Worker...');
      
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      
      await navigator.serviceWorker.ready;
      addDiagnosticLog('Service Worker registrado com sucesso');
      updateDiagnosticInfo({ serviceWorkerStatus: 'active' });
      
      return registration;
    } catch (error: any) {
      addDiagnosticLog(`ERRO no Service Worker: ${error.message}`);
      updateDiagnosticInfo({ serviceWorkerStatus: 'error' });
      throw error;
    }
  }, [addDiagnosticLog, updateDiagnosticInfo]);

  // Save FCM token to database
  const saveTokenToDatabase = useCallback(async (token: string, userId: string, accountId: string) => {
    try {
      addDiagnosticLog('Salvando token no banco...');

      // Check if token already exists
      const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('endpoint', token)
        .eq('user_id', userId)
        .single();

      if (existing) {
        // Update existing
        await supabase
          .from('push_subscriptions')
          .update({ 
            is_active: true,
            device_name: `${navigator.userAgent.substring(0, 50)}...`
          })
          .eq('id', existing.id);
        addDiagnosticLog('Token atualizado no banco');
      } else {
        // Insert new - using endpoint field to store FCM token
        await supabase
          .from('push_subscriptions')
          .insert({
            user_id: userId,
            account_id: accountId,
            endpoint: token,
            p256dh: 'fcm', // Placeholder for FCM
            auth: 'fcm', // Placeholder for FCM
            is_active: true,
            device_name: `${navigator.userAgent.substring(0, 50)}...`
          });
        addDiagnosticLog('Novo token salvo no banco');
      }

      return true;
    } catch (error: any) {
      addDiagnosticLog(`ERRO ao salvar token: ${error.message}`);
      console.error('[FCM] Error saving token:', error);
      return false;
    }
  }, [addDiagnosticLog]);

  // Remove FCM token from database
  const removeTokenFromDatabase = useCallback(async (token: string) => {
    try {
      addDiagnosticLog('Removendo token do banco...');
      
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('endpoint', token);
      
      addDiagnosticLog('Token desativado no banco');
      return true;
    } catch (error: any) {
      addDiagnosticLog(`ERRO ao remover token: ${error.message}`);
      return false;
    }
  }, [addDiagnosticLog]);

  // Initialize Firebase on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (initAttemptedRef.current) return;
    
    if (!checkBrowserSupport()) {
      setIsLoading(false);
      updateDiagnosticInfo({ serviceWorkerStatus: 'unsupported' });
      return;
    }

    initAttemptedRef.current = true;

    const init = async () => {
      try {
        const firebaseResult = await loadFirebaseSDK();
        if (firebaseResult) {
          setIsInitialized(true);
          
          // Check if already has permission
          const permission = Notification.permission;
          setPermissionState(permission as 'default' | 'granted' | 'denied');
          
          // If already granted and user is logged in, check for existing token
          if (permission === 'granted' && user?.id && account?.id) {
            const { data: existing } = await supabase
              .from('push_subscriptions')
              .select('endpoint, is_active')
              .eq('user_id', user.id)
              .eq('is_active', true)
              .single();
            
            if (existing) {
              setIsSubscribed(true);
              setFcmToken(existing.endpoint);
              updateDiagnosticInfo({ 
                fcmToken: existing.endpoint,
                userId: user.id 
              });
              addDiagnosticLog('Token existente encontrado');
            }
          }
        }
      } catch (error: any) {
        addDiagnosticLog(`ERRO na inicialização: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [user?.id, account?.id, loadFirebaseSDK, addDiagnosticLog, updateDiagnosticInfo]);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    addDiagnosticLog('Iniciando subscribe...');
    
    if (!user?.id || !account?.id) {
      addDiagnosticLog('ERRO: Usuário não autenticado');
      toast.error('Você precisa estar logado para ativar notificações');
      return false;
    }

    try {
      setIsLoading(true);

      // Load Firebase SDK
      const firebaseResult = await loadFirebaseSDK();
      if (!firebaseResult) {
        throw new Error('Firebase não suportado');
      }

      // Register service worker
      const swRegistration = await registerServiceWorker();

      // Request notification permission
      addDiagnosticLog('Solicitando permissão...');
      const permission = await Notification.requestPermission();
      setPermissionState(permission as 'default' | 'granted' | 'denied');
      addDiagnosticLog(`Permissão: ${permission}`);

      if (permission !== 'granted') {
        toast.error('Permissão para notificações foi negada');
        return false;
      }

      // Get FCM token
      addDiagnosticLog('Obtendo token FCM...');
      const { getToken } = await import('firebase/messaging');
      const token = await getToken(messagingRef.current, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swRegistration
      });

      if (!token) {
        throw new Error('Não foi possível obter token FCM');
      }

      addDiagnosticLog(`Token obtido: ${token.substring(0, 20)}...`);
      setFcmToken(token);

      // Save to database
      await saveTokenToDatabase(token, user.id, account.id);

      setIsSubscribed(true);
      updateDiagnosticInfo({ 
        fcmToken: token,
        userId: user.id 
      });

      toast.success('Push notifications ativadas!');
      return true;
    } catch (error: any) {
      addDiagnosticLog(`ERRO no subscribe: ${error.message}`);
      console.error('[FCM] Subscribe error:', error);
      toast.error('Erro ao ativar push notifications');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, account, loadFirebaseSDK, registerServiceWorker, saveTokenToDatabase, addDiagnosticLog, updateDiagnosticInfo]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    try {
      setIsLoading(true);
      addDiagnosticLog('Desativando notificações...');

      if (fcmToken) {
        await removeTokenFromDatabase(fcmToken);
      }

      setIsSubscribed(false);
      setFcmToken(null);
      updateDiagnosticInfo({ fcmToken: null });

      toast.success('Push notifications desativadas');
      return true;
    } catch (error: any) {
      addDiagnosticLog(`ERRO no unsubscribe: ${error.message}`);
      console.error('[FCM] Unsubscribe error:', error);
      toast.error('Erro ao desativar push notifications');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fcmToken, removeTokenFromDatabase, addDiagnosticLog, updateDiagnosticInfo]);

  // Send test notification
  const sendTestNotification = useCallback(async () => {
    if (!isSubscribed || !user) {
      toast.error('Ative as notificações push primeiro');
      return;
    }

    try {
      addDiagnosticLog('Enviando notificação de teste...');
      
      const { error } = await supabase.functions.invoke('send-fcm-notification', {
        body: {
          user_ids: [user.id],
          title: '🧪 Teste de Notificação',
          body: 'Se você está vendo isso, FCM está funcionando!',
          url: '/settings'
        }
      });

      if (error) throw error;
      
      addDiagnosticLog('Notificação de teste enviada!');
      toast.success('Notificação de teste enviada!');
    } catch (error: any) {
      addDiagnosticLog(`ERRO no teste: ${error.message}`);
      console.error('[FCM] Test notification error:', error);
      toast.error('Erro ao enviar notificação de teste');
    }
  }, [isSubscribed, user, addDiagnosticLog]);

  // Refresh diagnostic info
  const getDiagnosticInfo = useCallback(async () => {
    updateDiagnosticInfo({
      isIOS: checkIsIOS(),
      isPWA: checkIsPWA(),
      userId: user?.id || null
    });
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
    // Diagnostic exports
    diagnosticInfo,
    diagnosticLogs,
    getDiagnosticInfo,
    addDiagnosticLog
  };
}
