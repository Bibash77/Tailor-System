/* Firebase Cloud Messaging Service Worker — background push handler */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyDbAt8Shp7mJCNR_vhPEdly1e6wzmtRu2E',
  authDomain:        'tailor-app-9d570.firebaseapp.com',
  projectId:         'tailor-app-9d570',
  storageBucket:     'tailor-app-9d570.firebasestorage.app',
  messagingSenderId: '302737109397',
  appId:             '1:302737109397:web:0c26c615dd43aec10d469c',
});

const messaging = firebase.messaging();

// Handle background push messages
messaging.onBackgroundMessage((payload) => {
  const title   = payload.notification?.title || payload.data?.title  || 'Tailor Manager';
  const body    = payload.notification?.body  || payload.data?.message || '';
  const icon    = '/favicon.ico';
  const data    = payload.data || {};

  self.registration.showNotification(title, {
    body,
    icon,
    badge:  icon,
    tag:    data.dedupKey || 'tailor-notification',
    renotify: true,
    data,
  });
});

// Navigate to app on notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const module = event.notification.data?.moduleRedirect || '';
  const url    = self.location.origin + (module ? '/#' + module : '/');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', moduleRedirect: module });
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});
