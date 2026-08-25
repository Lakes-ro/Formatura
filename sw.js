// sw.js
// Service Worker do projeto "Formatura — Homenagens".
// Nome de cache bem específico para nunca colidir com Service Workers
// de outros projetos (ex: marketplace) rodando na mesma origem/porta.
const CACHE_NAME = 'formatura-homenagens-v1';

const ARQUIVOS_APP_SHELL = [
  './index.html',
  './style.css',
  './supabase.js',
  './form.js',
  './manifest-publico.json',
  './icon-192.png',
  './icon-512.png',
];

// Instala e já ativa a versão nova imediatamente (sem esperar todas as abas fecharem)
self.addEventListener('install', (evento) => {
  self.skipWaiting();
  evento.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARQUIVOS_APP_SHELL).catch(() => {}))
  );
});

// Remove caches de versões antigas deste mesmo projeto
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes
          .filter((nome) => nome.startsWith('formatura-homenagens-') && nome !== CACHE_NAME)
          .map((nome) => caches.delete(nome))
      )
    )
  );
  self.clients.claim();
});

// Estratégia: network-first para .js/.html (sempre busca versão nova primeiro,
// evitando o problema de ficar servindo JS desatualizado do cache), e
// cache-first para o resto (imagens, ícones).
self.addEventListener('fetch', (evento) => {
  const url = new URL(evento.request.url);
  if (url.origin !== self.location.origin) return;

  const ehCodigo = url.pathname.endsWith('.js') || url.pathname.endsWith('.html');

  if (ehCodigo) {
    evento.respondWith(
      fetch(evento.request)
        .then((resposta) => {
          const copia = resposta.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(evento.request, copia));
          return resposta;
        })
        .catch(() => caches.match(evento.request))
    );
  } else {
    evento.respondWith(
      caches.match(evento.request).then((cacheado) => cacheado || fetch(evento.request))
    );
  }
});
