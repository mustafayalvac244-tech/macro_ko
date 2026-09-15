// Çevrimdışı önbellek. Fabrika içinde kapsama zayıfsa uygulama yine açılsın diye.
// Sürüm değişince eski önbellek silinir; böylece "eski sürüm takıldı" olmaz.
const SURUM = 'arac-audit-v1';
const DOSYALAR = [
  './', './index.html', './manifest.webmanifest', './simge.svg', './css/stil.css',
  './js/uygulama.js', './js/katalog.js', './js/vin.js', './js/model3d.js',
  './js/puan.js', './js/depo.js', './js/rapor.js', './js/xlsx.js', './js/zip.js', './js/goruntu.js',
];

self.addEventListener('install', (o) => {
  o.waitUntil(caches.open(SURUM).then((c) => c.addAll(DOSYALAR)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (o) => {
  o.waitUntil(caches.keys()
    .then((adlar) => Promise.all(adlar.filter((a) => a !== SURUM).map((a) => caches.delete(a))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (o) => {
  if (o.request.method !== 'GET') return;
  o.respondWith(
    fetch(o.request)
      .then((y) => {
        const kopya = y.clone();
        caches.open(SURUM).then((c) => c.put(o.request, kopya)).catch(() => {});
        return y;
      })
      .catch(() => caches.match(o.request).then((v) => v ?? caches.match('./index.html'))),
  );
});
