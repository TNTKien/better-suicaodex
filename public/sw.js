// Service Worker for offline reading
const CACHE_NAME = 'suicaodex-v1';

// Tài nguyên cần cache ngay khi cài đặt
const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/images/place-doro.webp',
  '/images/xidoco.webp',
  '/images/maintain.webp',
];

// Cài đặt service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Kích hoạt service worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName !== CACHE_NAME;
          })
          .map((cacheName) => {
            return caches.delete(cacheName);
          })
      );
    })
  );
  self.clients.claim();
});

// Xử lý fetch requests
self.addEventListener('fetch', (event) => {
  // Bỏ qua các requests không phải HTTP/HTTPS
  if (!event.request.url.startsWith('http')) return;
  
  // Xử lý các requests đến API
  if (event.request.url.includes('/api/')) {
    // Network-first strategy cho API calls
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Xử lý các requests đến ảnh truyện
  if (event.request.url.includes('/covers/') || event.request.url.includes('/ch/')) {
    // Cache-first strategy cho ảnh truyện
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request).then((response) => {
          // Không cache nếu response không ok
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone response để cache
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          
          return response;
        });
      })
    );
    return;
  }
  
  // Xử lý các requests khác
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request).then((response) => {
        // Không cache nếu response không ok
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        // Clone response để cache
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      }).catch(() => {
        // Trả về trang offline nếu là request HTML
        if (event.request.headers.get('Accept').includes('text/html')) {
          return caches.match('/offline.html');
        }
        
        // Trả về placeholder image nếu là request hình ảnh
        if (event.request.headers.get('Accept').includes('image')) {
          return caches.match('/images/place-doro.webp');
        }
      });
    })
  );
});

// Xử lý message từ client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_CHAPTER_IMAGES') {
    const { images, chapterId } = event.data;
    
    if (!images || !images.length || !chapterId) return;
    
    // Thông báo cho client rằng đã nhận được yêu cầu
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'CHAPTER_CACHED',
          chapterId: chapterId,
          success: true
        });
      });
    });
    
    // Không cache ảnh bằng Cache API nữa vì có thể gây ra lỗi CORS
    // Việc cache sẽ được xử lý bởi IndexedDB trong hooks/use-offline-chapter.ts
  }
});
