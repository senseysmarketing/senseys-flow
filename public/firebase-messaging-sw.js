// Firebase Messaging Service Worker
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

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || 'Nova Notificação';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
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

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click:', event);
  
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
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open with our app
        for (const client of windowClients) {
          if (client.url.includes('crm.senseys.com.br') && 'focus' in client) {
            client.navigate(fullUrl);
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
  );
});

// Handle push events directly (fallback)
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Push event received');
  
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('[firebase-messaging-sw.js] Push data:', data);
      
      // If not handled by onBackgroundMessage, show notification manually
      if (!data.notification) {
        const title = data.data?.title || 'Nova Notificação';
        const options = {
          body: data.data?.body || '',
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          data: data.data || {}
        };
        
        event.waitUntil(
          self.registration.showNotification(title, options)
        );
      }
    } catch (e) {
      console.error('[firebase-messaging-sw.js] Error parsing push data:', e);
    }
  }
});

console.log('[firebase-messaging-sw.js] Service worker loaded');
