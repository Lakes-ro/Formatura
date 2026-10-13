// mural.js
// Página pública que mostra somente as dedicatórias aprovadas.
// RLS no Supabase já garante isso (anon só enxerga aprovado = true),
// mas o filtro aqui também deixa a intenção explícita.

import { supabase } from './supabase.js';

const TAGS_PERMITIDAS = ['b', 'i', 'u', 'strong', 'em', 'br', 'p', 'div'];

const gridEl = document.getElementById('grid-dedicatorias');
const vazioEl = document.getElementById('mural-vazio');
const contadorEl = document.getElementById('contador-homenagens');
const contadorLabelEl = document.getElementById('hero-stats-label');

const TEXTO_VAZIO_PADRAO = vazioEl.textContent;

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const PREFIXO_MIDIA = 'https://zqaozrockgktjuumokox.supabase.co/storage/v1/object/public/midias/';
function urlMidiaSegura(url) {
  if (typeof url !== 'string' || !url.startsWith(PREFIXO_MIDIA)) return '';
  return /^[A-Za-z0-9._~:\/?#@!$&()*+,;=%-]+$/.test(url) ? url : '';
}

function criarBlocoMidia(item) {
  const url = urlMidiaSegura(item.midia_url);
  if (!url) return '';
  const nomeSeguro = escaparHtml(item.nome);
  if (item.midia_tipo === 'imagem') {
    return `<div class="midia"><img src="${url}" alt="Imagem enviada por ${nomeSeguro}" loading="lazy"></div>`;
  }
  if (item.midia_tipo === 'audio') {
    return `<div class="midia"><audio controls src="${url}"></audio></div>`;
  }
  return '';
}

function criarCard(item, indice = 0) {
  const mensagemSegura = DOMPurify.sanitize(item.mensagem, {
    ALLOWED_TAGS: TAGS_PERMITIDAS,
    ALLOWED_ATTR: [],
  });

  const card = document.createElement('article');
  card.className = 'card-dedicatoria';
  card.dataset.id = item.id;
  card.style.setProperty('--i', indice);
  card.innerHTML = `
    <span class="aspas" aria-hidden="true">&#10078;</span>
    <div class="mensagem">${mensagemSegura}</div>
    ${criarBlocoMidia(item)}
    <div class="assinatura">
      <span class="nome">${escaparHtml(item.nome)}</span>
      <span class="relacao">${escaparHtml(item.relacao)}</span>
    </div>
  `;
  return card;
}

function atualizarEstadoVazio() {
  vazioEl.hidden = gridEl.children.length > 0;
}

function atualizarContador(total) {
  contadorEl.textContent = total;
  contadorLabelEl.textContent = total === 1
    ? 'homenagem recebida até agora'
    : 'homenagens recebidas até agora';
}

// Assinatura do último conteúdo renderizado: só reconstrói o grid quando
// algo realmente mudou (evita reiniciar as animações a cada atualização).
let assinaturaAtual = null;
let carregando = false;

async function carregarMural() {
  if (carregando) return;
  carregando = true;

  try {
    const { data, error } = await supabase
      .from('dedicatorias')
      .select('id, nome, relacao, mensagem, midia_url, midia_tipo, criado_em')
      .eq('aprovado', true)
      .order('criado_em', { ascending: false });

    if (error) {
      console.error(error);
      if (assinaturaAtual === null) {
        vazioEl.hidden = false;
        vazioEl.textContent = 'Não foi possível carregar as homenagens agora. Tente recarregar a página.';
      }
      return;
    }

    vazioEl.textContent = TEXTO_VAZIO_PADRAO;
    atualizarContador(data.length);

    const assinatura = data
      .map((i) => [i.id, i.nome, i.relacao, i.mensagem, i.midia_url].join('\u0001'))
      .join('\u0002');

    if (assinatura !== assinaturaAtual) {
      assinaturaAtual = assinatura;
      gridEl.innerHTML = '';
      data.forEach((item, indice) => gridEl.appendChild(criarCard(item, indice)));
    }
    atualizarEstadoVazio();
  } finally {
    carregando = false;
  }
}

// ---------------------------------------------------------------
// Atualização ao vivo.
// O Realtime não entrega ao visitante (anon) o evento de "desaprovar"
// (a policy bloqueia a linha), então, além de escutar eventos, o mural
// refaz a consulta: a cada 30 s e quando a aba volta a ficar visível.
// ---------------------------------------------------------------
let timerRecarga = null;
function agendarRecarga() {
  clearTimeout(timerRecarga);
  timerRecarga = setTimeout(carregarMural, 300);
}

function iniciarRealtime() {
  supabase
    .channel('mural-publico')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dedicatorias' }, agendarRecarga)
    .subscribe();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') carregarMural();
});
setInterval(carregarMural, 30000);

carregarMural();
iniciarRealtime();
