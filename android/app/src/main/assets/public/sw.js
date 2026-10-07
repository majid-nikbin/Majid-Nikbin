// Mariner Pro-Link - High Performance 100% Offline Marine Service Worker
const CACHE_NAME = 'mariner-pro-offline-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME && !k.startsWith('mariner-tiles-')).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  
  // Ignore non-GET and chrome-extension requests
  if (req.method !== 'GET' || req.url.startsWith('chrome-extension://')) {
    return;
  }

  // Marine Tile requests: Cache-First for instant offline map rendering with zero network delay
  if (req.url.includes('google.com/vt/') || req.url.includes('arcgisonline.com') || req.url.includes('openstreetmap') || req.url.includes('openseamap.org')) {
    event.respondWith(
      caches.open('mariner-tiles-offline-v2').then(async (tileCache) => {
        const cached = await tileCache.match(req);
        if (cached) {
          return cached;
        }
        return fetch(req).then((netRes) => {
          if (netRes && netRes.ok) {
            tileCache.put(req, netRes.clone());
          }
          return netRes;
        }).catch(() => {
          return new Response('', { status: 408, statusText: 'Tile Offline Unavailable' });
        });
      })
    );
    return;
  }

  // Navigation requests (HTML document): Cache First with network fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return networkRes;
      }).catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const indexCached = await caches.match('./index.html') || await caches.match('./');
        if (indexCached) return indexCached;
        return new Response('Offline - Mariner Pro is ready', { headers: { 'Content-Type': 'text/plain' } });
      })
    );
    return;
  }

  // Static assets (JS, CSS, Images, Fonts): Cache First for instantaneous offline boot
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      if (cachedRes) {
        // Return cached immediately; optionally refresh in background
        fetch(req).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, networkRes));
          }
        }).catch(() => {});
        return cachedRes;
      }

      return fetch(req).then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return networkRes;
      }).catch(() => {
        // Fallback or empty response if fully offline and not cached yet
        return cachedRes || new Response('', { status: 408, statusText: 'Offline Asset Unavailable' });
      });
    })
  );
});
