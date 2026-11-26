const CACHE_NAME = 'maestro-app-v4';
const APP_ASSETS = [
  './index.html',
  './Devocional.html',
  './maestro-content.js',
  './Logo.jpg',
  './icon-192.png',
  './icon-512.png'
];
const OPTIONAL_ASSETS = [
  { url: 'https://cdn.tailwindcss.com/', mode: 'no-cors' },
  { url: 'https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap', mode: 'cors' }
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_ASSETS))
      .then(async cache => {
        await Promise.all(OPTIONAL_ASSETS.map(async asset => {
          try {
            const response = await fetch(asset.url, { mode: asset.mode });
            if (response.ok || response.type === 'opaque') {
              await cache.put(asset.url, response.clone());
            }
            if (asset.url.startsWith('https://fonts.googleapis.com/') && response.ok) {
              const css = await response.text();
              const fontUrls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(match => match[1]);
              await Promise.all(fontUrls.map(async url => {
                try {
                  const font = await fetch(url, { mode: 'cors' });
                  if (font.ok) await cache.put(url, font);
                } catch (error) {
                  console.error('No se pudo guardar una fuente en caché:', error);
                }
              }));
            }
          } catch (error) {
            console.error('No se pudo guardar un recurso opcional en caché:', error);
          }
        }));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith('maestro-app-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const networkResponse = fetch(request);
  event.waitUntil(
    networkResponse.then(response => {
      if (!response.ok && response.type !== 'opaque') return;
      return caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
    }).catch(error => console.error('No se pudo actualizar la caché:', error))
  );
  event.respondWith(
    networkResponse.catch(error => caches.match(request).then(cached => {
      if (cached) return cached;
      if (request.mode === 'navigate') {
        return caches.match('./index.html').then(fallback => fallback || Promise.reject(error));
      }
      return Promise.reject(error);
    }))
  );
});
