// sw.js
// Service Worker do projeto "Formatura — Homenagens".
// Nome de cache específico para nunca colidir com outros projetos na mesma origem.
const CACHE_NAME = 'formatura-homenagens-v4';

const ARQUIVOS_APP_SHELL = [
  './index.html',
  './mural.html',
  './style.css',
  './supabase.js',
  './form.js',
  './mural.js',
  './galeria.js',
  './manifest-publico.json',
  './icon-192.png',
  './icon-512.png',
];

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

// network-first para .js/.html/.css (sempre busca a versão nova primeiro;
// antes o CSS era cache-first e correções de estilo nunca chegavam),
// cache-first para o resto (imagens, ícones, áudio).
self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;

  const url = new URL(evento.request.url);
  if (url.origin !== self.location.origin) return;

  const ehCodigo =
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('/');

  if (ehCodigo) {
    evento.respondWith(
      fetch(evento.request)
        .then((resposta) => {
          if (resposta.ok) {
            const copia = resposta.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(evento.request, copia));
          }
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

// ---------------------------------------------------------------
// Web Push: alerta de nova dedicatória (enviado pela Edge Function
// "notificar-dedicatoria"), mesmo com o app/aba fechados.
// ---------------------------------------------------------------
self.addEventListener('push', (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch (e) {
    dados = { corpo: evento.data ? evento.data.text() : '' };
  }

  const titulo = dados.titulo || 'Nova homenagem recebida 🎓';
  const opcoes = {
    body: dados.corpo || 'Alguém deixou uma homenagem.',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: dados.tag || 'nova-dedicatoria', // mesma tag = substitui, não duplica
    renotify: true,
    data: { url: dados.url || 'admin.html' },
  };

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      // Se o painel já está aberto e visível, o toast interno avisa;
      // evita notificação do sistema duplicada.
      const painelVisivel = janelas.some(
        (j) => j.visibilityState === 'visible' && j.url.includes('admin.html')
      );
      if (painelVisivel) return;
      return self.registration.showNotification(titulo, opcoes);
    })
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const alvo = new URL(
    (evento.notification.data && evento.notification.data.url) || 'admin.html',
    self.registration.scope
  ).href;

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      const aberta = janelas.find((j) => j.url.includes('admin.html'));
      if (aberta) return aberta.focus();
      return self.clients.openWindow(alvo);
    })
  );
});
