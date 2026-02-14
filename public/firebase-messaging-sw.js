// Firebase Messaging Service Worker
// Version: 3.0.0 - Simplificado para Safari/iOS

console.log('[FCM-SW] Inicializando Service Worker v3...');

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAfzJpXN9DHeAL_-a-_nWX7xIm64UmDix8",
  authDomain: "crm-senseys-web.firebaseapp.com",
  projectId: "crm-senseys-web",
  storageBucket: "crm-senseys-web.firebasestorage.app",
  messagingSenderId: "974602486500",
  appId: "1:974602486500:web:6a7b7a6e18cf4291c1a2f1"
});

console.log('[FCM-SW] Firebase inicializado');

// Install - toma controle imediatamente
self.addEventListener('install', () => {
  console.log('[FCM-SW] Instalado!');
  self.skipWaiting();
});

// Activate - assume todos os clientes
self.addEventListener('activate', (event) => {
  console.log('[FCM-SW] Ativado!');
  event.waitUntil(clients.claim());
});

// Skip waiting quando solicitado
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Push handler único (sem onBackgroundMessage para evitar conflito)
self.addEventListener('push', (event) => {
  console.log('[FCM-SW] Push event recebido');
  if (!event.data) return;

  event.waitUntil((async () => {
    try {
      const raw = event.data.text();
      console.log('[FCM-SW] Push raw data:', raw);

      let msg;
      try {
        msg = event.data.json();
      } catch {
        msg = { data: { body: raw } };
      }

      console.log('[FCM-SW] Push JSON data:', JSON.stringify(msg));

      const title =
        msg?.notification?.title ||
        msg?.data?.title ||
        'Nova Notificação';

      const body =
        msg?.notification?.body ||
        msg?.data?.body ||
        '';

      const url =
        msg?.data?.click_action ||
        msg?.data?.url ||
        'https://crmsenseys.com.br/leads';

      const options = {
        body,
        icon: 'https://crmsenseys.com.br/pwa-192x192.png',
        badge: 'https://crmsenseys.com.br/pwa-192x192.png',
        tag: `fcm-${Date.now()}`,
        renotify: true,
        data: { ...msg?.data, click_action: url }
      };

      console.log('[FCM-SW] Exibindo notificação:', title);
      await self.registration.showNotification(title, options);
    } catch (e) {
      console.error('[FCM-SW] Erro ao processar push:', e);
    }
  })());
});

// Click handler simplificado
self.addEventListener('notificationclick', (event) => {
  console.log('[FCM-SW] Notification click');
  event.notification.close();
  
  const url = event.notification.data?.click_action || 
              'https://crmsenseys.com.br/leads';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes('crmsenseys.com.br') && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

console.log('[FCM-SW] Service Worker v3 pronto!');
