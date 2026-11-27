// Service worker di TRAINING SUITE (modello: vite.config.ts lo copia in dist/sw.js sostituendo 900cd4b).
// Serve a rendere l'app installabile su Android (Chrome e Samsung Internet) e a riaprirla anche senza rete.
// - pagine: prima la rete, poi la copia salvata (così gli aggiornamenti arrivano subito)
// - file con nome versionato (assets/…), icone, manifest: prima la copia salvata, poi la rete
// - version.json: sempre dalla rete (controllo delle nuove versioni)
const CACHE = 'training-suite-900cd4b';
const BASE = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // elimina le copie delle versioni precedenti
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('training-suite-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/version.json')) return;
  if (url.pathname.includes('/api/')) return; // API sul server (prova del database): mai dalla copia salvata

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) {
            const copia = r.clone();
            caches.open(CACHE).then((c) => c.put('./', copia));
          }
          return r;
        })
        .catch(() => caches.match('./')),
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(
      (salvato) =>
        salvato ||
        fetch(req).then((r) => {
          if (r.ok) {
            const copia = r.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return r;
        }),
    ),
  );
});
