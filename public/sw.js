// 最小 Service Worker，满足 Android Chrome「添加到主屏幕」的安装条件
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request, { cache: event.request.mode === 'navigate' ? 'no-store' : 'default' }).catch(() => {
      return new Response('', { status: 503, statusText: 'Service Unavailable' });
    })
  );
});
