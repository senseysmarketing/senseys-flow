// Firebase Messaging Service Worker
// Version: 2.0.0 - Enhanced for iOS/Safari PWA

console.log('[FCM-SW] Inicializando Service Worker...');

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration
firebase.initializeApp({
  apiKey: "AIzaSyAfzJpXN9DHeAL_-a-_nWX7xIm64UmDix8",
  authDomain: "crm-senseys-web.firebaseapp.com",
  projectId: "crm-senseys-web",
  storageBucket: "crm-senseys-web.firebasestorage.app",
  messagingSenderId: "974602486500",
  appId: "1:974602486500:web:6a7b7a6e18cf4291c1a2f1"
});

console.log('[FCM-SW] Firebase inicializado');

const messaging = firebase.messaging();

// Install event - immediately take over
self.addEventListener('install', (event) => {
  console.log('[FCM-SW] Instalado!');
  self.skipWaiting();
});

// Activate event - claim all clients
self.addEventListener('activate', (event) => {
  console.log('[FCM-SW] Ativado!');
  event.waitUntil(clients.claim());
});

// Listen for skip waiting message
self.addEventListener('message', (event) => {
  console.log('[FCM-SW] Mensagem recebida:', event.data);
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM-SW] Mensagem background recebida:', payload);
  console.log('[FCM-SW] Payload completo:', JSON.stringify(payload));
  
  const notificationTitle = payload.notification?.title || 'Nova Notificação';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    tag: 'fcm-notification-' + Date.now(),
    renotify: true,
    data: payload.data || {},
    actions: [
      {
        action: 'open',
        title: 'Abrir'
      },
      {
        action: 'close',
        title: 'Fechar'
      }
    ]
  };

  console.log('[FCM-SW] Exibindo notificação:', notificationTitle);
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[FCM-SW] Notification click:', event);
  console.log('[FCM-SW] Action:', event.action);
  console.log('[FCM-SW] Data:', event.notification.data);
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  // Get URL from notification data
  const urlToOpen = event.notification.data?.click_action || 
                    event.notification.data?.url || 
                    '/leads';
  
  const fullUrl = urlToOpen.startsWith('http') 
    ? urlToOpen 
    : `https://crm.senseys.com.br${urlToOpen}`;
  
  console.log('[FCM-SW] Abrindo URL:', fullUrl);
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open with our app
        for (const client of windowClients) {
          if (client.url.includes('crm.senseys.com.br') && 'focus' in client) {
            console.log('[FCM-SW] Focando janela existente');
            client.navigate(fullUrl);
            return client.focus();
          }
        }
        // If no window is open, open a new one
        console.log('[FCM-SW] Abrindo nova janela');
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
  );
});

// Handle push events directly (fallback for data-only messages)
self.addEventListener('push', (event) => {
  console.log('[FCM-SW] Push event recebido');
  console.log('[FCM-SW] Push data exists:', !!event.data);
  
  if (event.data) {
    try {
      const rawData = event.data.text();
      console.log('[FCM-SW] Push raw data:', rawData);
      
      const data = event.data.json();
      console.log('[FCM-SW] Push JSON data:', JSON.stringify(data));
      
      // If not handled by onBackgroundMessage (no notification property), show manually
      if (!data.notification) {
        console.log('[FCM-SW] Data-only message, showing manually');
        const title = data.data?.title || 'Nova Notificação';
        const options = {
          body: data.data?.body || '',
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: 'fcm-push-' + Date.now(),
          renotify: true,
          data: data.data || {}
        };
        
        event.waitUntil(
          self.registration.showNotification(title, options)
        );
      }
    } catch (e) {
      console.error('[FCM-SW] Erro ao processar push:', e);
    }
  }
});

console.log('[FCM-SW] Service Worker carregado e pronto!');
