// 16-Apr-2026 — Emanuele Motta
// Service Worker for offline support and caching

const CACHE_VERSION = 'v1';
const CACHE_NAME = `family-finance-${CACHE_VERSION}`;
const OFFLINE_CACHE = `family-finance-offline-${CACHE_VERSION}`;

const CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching core assets');
      return cache.addAll(CACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('family-finance-') && name !== CACHE_NAME && name !== OFFLINE_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - Network first, fallback to cache, fallback to offline page
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests, external APIs
  if (request.method !== 'GET' || url.hostname !== self.location.hostname) {
    return;
  }

  // For HTML pages, use network-first with fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const cache = caches.open(CACHE_NAME);
            cache.then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached))
    );
    return;
  }

  // For API calls, use stale-while-revalidate
  if (url.pathname.startsWith('/api') || url.hostname.includes('supabase')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetch_promise = fetch(request).then((response) => {
          if (response.ok) {
            const cache = caches.open(OFFLINE_CACHE);
            cache.then((c) => c.put(request, response.clone()));
          }
          return response;
        });

        return cached || fetch_promise;
      })
    );
    return;
  }

  // For other assets, use cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const cache = caches.open(CACHE_NAME);
            cache.then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          // No cache, no network
          return new Response('Offline - No cached version available', { status: 503 });
        });
    })
  );
});

// Handle background sync (for sending offline changes once back online)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(
      (async () => {
        try {
          const clients = await self.clients.matchAll();
          clients.forEach((client) => {
            client.postMessage({ type: 'SYNC_READY' });
          });
        } catch (error) {
          console.error('[SW] Sync error:', error);
        }
      })()
    );
  }
});

// Handle push notifications (for PWA notifications)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Nuova notifica',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: data.tag || 'family-finance',
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Family Finance', options));
});

// Local notifications triggered by app messages
self.addEventListener('message', (event) => {
  const payload = event.data;
  if (!payload || payload.type !== 'SHOW_LOCAL_NOTIFICATION') return;

  const options = {
    body: payload.body || 'Aggiorna le tue finanze',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: payload.tag || 'family-finance-local',
    data: { url: payload.url || '/' },
  };

  self.registration.showNotification(payload.title || 'Family Finance', options);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate?.(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

console.log('[SW] Service Worker loaded');
