// galeria.js
// Lightbox (usa <dialog> nativo) e animação de entrada da seção "Jornada".
// Script comum (não-módulo), carregado com defer.

(function () {
  const dialog = document.getElementById('lightbox');
  const imgEl = document.getElementById('lightbox-img');
  const legendaEl = document.getElementById('lightbox-legenda');

  // ---------------- Lightbox ----------------
  if (dialog && typeof dialog.showModal === 'function') {
    document.querySelectorAll('.foto-abrir').forEach((botao) => {
      botao.addEventListener('click', () => {
        const miniatura = botao.querySelector('img');
        imgEl.src = miniatura.currentSrc || miniatura.src;
        imgEl.alt = miniatura.alt;
        legendaEl.textContent = botao.dataset.legenda || '';
        document.body.style.overflow = 'hidden';
        dialog.showModal();
      });
    });

    // Clique no fundo escuro (o próprio <dialog>) ou no X fecha
    dialog.addEventListener('click', (evento) => {
      if (evento.target === dialog || evento.target.closest('.lightbox-fechar')) {
        dialog.close();
      }
    });

    // Esc também dispara 'close'
    dialog.addEventListener('close', () => {
      document.body.style.overflow = '';
      imgEl.removeAttribute('src');
    });
  }

  // ---------------- Entrada suave ao rolar ----------------
  const alvos = document.querySelectorAll('.jornada .foto-card, .jornada .jornada-texto, .jornada .jornada-titulo');
  if (!('IntersectionObserver' in window)) return;

  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      if (entrada.isIntersecting) {
        entrada.target.classList.add('visivel');
        observador.unobserve(entrada.target);
      }
    });
  }, { threshold: 0.12 });

  alvos.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = `${Math.min(i, 4) * 90}ms`;
    observador.observe(el);
  });
})();
