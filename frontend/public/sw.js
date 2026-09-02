// FAFLOW Web Push Service Worker
const SW_VERSION = 'faflow-sw-v1.0.0';

self.addEventListener('install', (event) => {
  // Activate worker immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all open pages immediately
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'FAFLOW Notification',
        body: event.data.text() || 'You have a new update in FAFLOW.',
      };
    }
  } else {
    data = {
      title: 'FAFLOW Notification',
      body: 'You have a new update in FAFLOW.',
    };
  }

  const title = data.title || 'FAFLOW Notification';
  const targetUrl = data.url || '/';

  const options = {
    body: data.body || 'You have a new activity update.',
    icon: '/icon-192.png',
    badge: '/icon.svg',
    tag: data.tag || 'faflow-notification',
    renotify: true,
    data: {
      url: targetUrl,
      event_type: data.event_type || 'general',
      timestamp: Date.now(),
    },
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'View Details' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, navigate and focus it
      for (const client of clientList) {
        if ('focus' in client && client.url.includes(self.location.origin)) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // If no tab is open, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
