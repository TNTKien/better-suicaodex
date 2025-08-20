import { clientsClaim, skipWaiting } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';
import { BackgroundSync } from 'workbox-background-sync';

declare const self: ServiceWorkerGlobalScope;

// Enable immediate control of the page
clientsClaim();
skipWaiting();

// Clean up outdated caches
cleanupOutdatedCaches();

// Precache and route for app shell
precacheAndRoute(self.__WB_MANIFEST);

// App shell - cache with stale-while-revalidate
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new StaleWhileRevalidate({
    cacheName: 'app-shell',
  })
);

// Static assets - cache first
registerRoute(
  ({ request }) => 
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [{
      cacheWillUpdate: async ({ response }) => {
        return response.status === 200 ? response : null;
      },
    }],
  })
);

// API requests - network first with fallback to cache
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 3,
    plugins: [{
      cacheWillUpdate: async ({ response }) => {
        return response.status === 200 ? response : null;
      },
    }],
  })
);

// External API (MangaDex) - network first
registerRoute(
  ({ url }) => url.hostname === 'api.suicaodex.com',
  new NetworkFirst({
    cacheName: 'mangadx-api',
    networkTimeoutSeconds: 10,
    plugins: [{
      cacheWillUpdate: async ({ response }) => {
        return response.status === 200 ? response : null;
      },
    }],
  })
);

// Chapter images - handled by our custom cache system
registerRoute(
  ({ url, request }) => 
    url.hostname === 'api.suicaodx.com' && 
    request.destination === 'image',
  new CacheFirst({
    cacheName: 'chapters-images',
    plugins: [{
      cacheWillUpdate: async ({ response }) => {
        return response.status === 200 ? response : null;
      },
    }],
  })
);

// Background sync for failed downloads
const bgSync = new BackgroundSync('download-queue', {
  maxRetentionTime: 24 * 60, // 24 hours in minutes
});

// Register background sync route for download requests
registerRoute(
  ({ url }) => url.pathname.includes('/download-chapter'),
  bgSync
);

// Handle background sync events
self.addEventListener('sync', (event) => {
  if (event.tag === 'download-queue') {
    event.waitUntil(handleBackgroundSync());
  }
});

async function handleBackgroundSync() {
  try {
    // Notify the main app that background sync is running
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC_START',
      });
    });

    // The actual download logic is handled by the DownloadManager
    // We just notify the app to check for pending downloads
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC_RESUME_DOWNLOADS',
      });
    });
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Handle messages from the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon/icon-192x192.png',
      badge: '/icon/icon-192x192.png',
      data: data.data,
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      self.clients.openWindow(event.notification.data.url)
    );
  }
});

// Cache warming for critical resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('critical-resources').then((cache) => {
      return cache.addAll([
        '/',
        '/manifest.json',
        '/icon/icon-192x192.png',
        '/icon/icon-512x512.png',
      ]);
    })
  );
});

// Network error handling
self.addEventListener('fetch', (event) => {
  // Handle chapter image requests that might be cached
  if (event.request.url.includes('api.suicaodx.com') && event.request.destination === 'image') {
    event.respondWith(
      handleChapterImageRequest(event.request)
    );
  }
});

async function handleChapterImageRequest(request: Request): Promise<Response> {
  try {
    // Try cache first for chapter images
    const cache = await caches.open('chapters-images');
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }

    // If not in cache, try network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Return a placeholder or error response
    return new Response('Image not available offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}