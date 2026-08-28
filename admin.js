// admin.js
import { supabase, BUCKET_MIDIAS } from './supabase.js';

const TAGS_PERMITIDAS = ['b', 'i', 'u', 'strong', 'em', 'br', 'p'];

const listaEl = document.getElementById('lista-dedicatorias');
const listaVaziaEl = document.getElementById('lista-vazia');
const abas = document.querySelectorAll('.aba');
const btnSair = document.getElementById('btn-sair');
const btnSino = document.getElementById('btn-sino');
const badgeEl = document.getElementById('badge-notificacao');
const areaToasts = document.getElementById('area-toasts');
const painelNotificacoesEl = document.getElementById('painel-notificacoes');
const listaNotificacoesEl = document.getElementById('lista-notificacoes');

let itens = [];
let filtroAtual = 'pendentes';
let naoLidas = 0;
let historicoNotificacoes = [];

// ---------------------------------------------------------------
// Notificações nativas do sistema (Web Notifications API)
// ---------------------------------------------------------------
function pedirPermissaoNotificacao() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function notificarSistema(titulo, corpo) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  // Se a página estiver em segundo plano ou minimizada, a notificação
  // do sistema operacional aparece mesmo assim, enquanto a aba estiver aberta.
  new Notification(titulo, { body: corpo, icon: 'icon-192.png' });
}

// ---------------------------------------------------------------
// Guarda de autenticação
// ---------------------------------------------------------------
async function protegerPagina() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location.href = 'admin_login.html';
    return false;
  }
  return true;
}

supabase.auth.onAuthStateChange((evento, sessao) => {
  if (evento === 'SIGNED_OUT' || !sessao) {
    window.location.href = 'admin_login.html';
  }
});

btnSair.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'admin_login.html';
});

// ---------------------------------------------------------------
// Toasts de notificação
// ---------------------------------------------------------------
function mostrarToast(texto) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = texto;
  areaToasts.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

function atualizarBadge() {
  if (naoLidas > 0) {
    badgeEl.textContent = naoLidas > 9 ? '9+' : String(naoLidas);
    badgeEl.hidden = false;
  } else {
    badgeEl.hidden = true;
  }
}

btnSino.addEventListener('click', (evento) => {
  evento.stopPropagation();
  const estaAberto = !painelNotificacoesEl.hidden;
  painelNotificacoesEl.hidden = estaAberto;
  if (!estaAberto) {
    naoLidas = 0;
    atualizarBadge();
  }
});

// Fecha o painel ao clicar fora dele
document.addEventListener('click', (evento) => {
  if (painelNotificacoesEl.hidden) return;
  if (evento.target.closest('.wrapper-notificacoes')) return;
  painelNotificacoesEl.hidden = true;
});

function adicionarNotificacao(texto) {
  historicoNotificacoes.unshift({ texto, hora: new Date() });
  historicoNotificacoes = historicoNotificacoes.slice(0, 20);
  renderizarPainelNotificacoes();
}

function renderizarPainelNotificacoes() {
  if (historicoNotificacoes.length === 0) {
    listaNotificacoesEl.innerHTML = '<p class="texto-vazio-notificacoes">Nenhuma notificação ainda.</p>';
    return;
  }

  listaNotificacoesEl.innerHTML = historicoNotificacoes
    .map((n) => `
      <div class="item-notificacao">
        ${escaparHtml(n.texto)}
        <span class="hora-notificacao">${n.hora.toLocaleString('pt-BR')}</span>
      </div>
    `)
    .join('');
}

// ---------------------------------------------------------------
// Carregamento e renderização da lista
// ---------------------------------------------------------------
async function carregarDedicatorias() {
  const { data, error } = await supabase
    .from('dedicatorias')
    .select('*')
    .order('criado_em', { ascending: false });

  if (error) {
    mostrarToast('Erro ao carregar dedicatórias.');
    console.error(error);
    return;
  }

  itens = data;
  renderizarLista();

  // Preenche o painel do sino com as últimas dedicatórias já existentes,
  // pra ele não ficar vazio até chegar algo novo em tempo real.
  historicoNotificacoes = itens.slice(0, 10).map((item) => ({
    texto: `Dedicatória de ${item.nome}`,
    hora: new Date(item.criado_em),
  }));
  renderizarPainelNotificacoes();
}

function itensFiltrados() {
  if (filtroAtual === 'pendentes') return itens.filter((item) => !item.aprovado);
  if (filtroAtual === 'aprovadas') return itens.filter((item) => item.aprovado);
  return itens;
}

function formatarData(iso) {
  return new Date(iso).toLocaleString('pt-BR');
}

// Escapa qualquer HTML antes de inserir nome/relacao no template —
// nome e relacao vêm de um <input> livre no formulário público e
// NUNCA devem ser tratados como HTML confiável.
function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

function criarBlocoMidia(item) {
  if (!item.midia_url) return '';
  const nomeSeguro = escaparHtml(item.nome);
  if (item.midia_tipo === 'imagem') {
    return `<div class="midia-item"><img src="${item.midia_url}" alt="Imagem enviada por ${nomeSeguro}"></div>`;
  }
  if (item.midia_tipo === 'audio') {
    return `<div class="midia-item"><audio controls src="${item.midia_url}"></audio></div>`;
  }
  return '';
}

function renderizarLista() {
  const lista = itensFiltrados();
  listaEl.innerHTML = '';
  listaVaziaEl.hidden = lista.length > 0;

  lista.forEach((item) => {
    const mensagemSegura = DOMPurify.sanitize(item.mensagem, {
      ALLOWED_TAGS: TAGS_PERMITIDAS,
      ALLOWED_ATTR: [],
    });

    const card = document.createElement('article');
    card.className = 'item-dedicatoria';
    card.dataset.id = item.id;

    card.innerHTML = `
      <div class="item-topo">
        <div>
          <span class="item-nome" data-campo="nome">${escaparHtml(item.nome)}</span>
          <span class="item-relacao" data-campo="relacao">${escaparHtml(item.relacao)}</span>
        </div>
        <label class="switch-aprovar">
          <input type="checkbox" class="check-aprovar" ${item.aprovado ? 'checked' : ''}>
          <span>Aprovado</span>
        </label>
      </div>

      <div class="item-mensagem" data-campo="mensagem" contenteditable="false">${mensagemSegura}</div>

      ${criarBlocoMidia(item)}

      <div class="item-rodape">
        <span class="item-data">${formatarData(item.criado_em)}</span>
        <div class="item-acoes">
          <button type="button" class="btn-secundario btn-editar">Editar</button>
          <button type="button" class="btn-secundario btn-salvar" hidden>Salvar</button>
          <button type="button" class="btn-perigo btn-excluir">Excluir</button>
        </div>
      </div>
    `;

    listaEl.appendChild(card);
  });
}

// ---------------------------------------------------------------
// Ações delegadas (checkbox, editar, salvar, excluir)
// ---------------------------------------------------------------
listaEl.addEventListener('change', async (evento) => {
  if (!evento.target.classList.contains('check-aprovar')) return;

  const card = evento.target.closest('.item-dedicatoria');
  const id = card.dataset.id;
  const aprovado = evento.target.checked;

  const { error } = await supabase.from('dedicatorias').update({ aprovado }).eq('id', id);

  if (error) {
    mostrarToast('Não foi possível atualizar a aprovação.');
    evento.target.checked = !aprovado;
    console.error(error);
    return;
  }

  const item = itens.find((i) => i.id === id);
  if (item) item.aprovado = aprovado;

  mostrarToast(aprovado ? 'Dedicatória aprovada.' : 'Aprovação removida.');
  renderizarLista();
});

listaEl.addEventListener('click', async (evento) => {
  const card = evento.target.closest('.item-dedicatoria');
  if (!card) return;
  const id = card.dataset.id;

  // Entrar em modo de edição
  if (evento.target.classList.contains('btn-editar')) {
    const mensagemEl = card.querySelector('[data-campo="mensagem"]');
    mensagemEl.contentEditable = 'true';
    mensagemEl.classList.add('editando');
    card.querySelector('.btn-editar').hidden = true;
    card.querySelector('.btn-salvar').hidden = false;
    mensagemEl.focus();
    return;
  }

  // Salvar edição
  if (evento.target.classList.contains('btn-salvar')) {
    const mensagemEl = card.querySelector('[data-campo="mensagem"]');
    const mensagemSanitizada = DOMPurify.sanitize(mensagemEl.innerHTML, {
      ALLOWED_TAGS: TAGS_PERMITIDAS,
      ALLOWED_ATTR: [],
    });

    const { error } = await supabase
      .from('dedicatorias')
      .update({ mensagem: mensagemSanitizada })
      .eq('id', id);

    if (error) {
      mostrarToast('Não foi possível salvar a edição.');
      console.error(error);
      return;
    }

    const item = itens.find((i) => i.id === id);
    if (item) item.mensagem = mensagemSanitizada;

    mensagemEl.contentEditable = 'false';
    mensagemEl.classList.remove('editando');
    card.querySelector('.btn-editar').hidden = false;
    card.querySelector('.btn-salvar').hidden = true;
    mostrarToast('Alterações salvas.');
    return;
  }

  // Excluir
  if (evento.target.classList.contains('btn-excluir')) {
    const confirmar = window.confirm('Excluir esta dedicatória permanentemente?');
    if (!confirmar) return;

    const item = itens.find((i) => i.id === id);

    const { error } = await supabase.from('dedicatorias').delete().eq('id', id);

    if (error) {
      mostrarToast('Não foi possível excluir.');
      console.error(error);
      return;
    }

    // Remove também o arquivo de mídia do Storage, se existir
    if (item?.midia_url) {
      const nomeArquivo = item.midia_url.split('/').pop();
      await supabase.storage.from(BUCKET_MIDIAS).remove([nomeArquivo]);
    }

    itens = itens.filter((i) => i.id !== id);
    mostrarToast('Dedicatória excluída.');
    renderizarLista();
  }
});

// ---------------------------------------------------------------
// Filtros (abas)
// ---------------------------------------------------------------
abas.forEach((aba) => {
  aba.addEventListener('click', () => {
    abas.forEach((a) => a.classList.remove('ativa'));
    aba.classList.add('ativa');
    filtroAtual = aba.dataset.filtro;
    renderizarLista();
  });
});

// ---------------------------------------------------------------
// Notificações em tempo real (novas dedicatórias)
// ---------------------------------------------------------------
function iniciarRealtime() {
  supabase
    .channel('dedicatorias-admin')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'dedicatorias' },
      (payload) => {
        itens.unshift(payload.new);
        naoLidas += 1;
        atualizarBadge();
        const texto = `Nova dedicatória de ${payload.new.nome}!`;
        mostrarToast(texto);
        adicionarNotificacao(texto);
        notificarSistema('Nova dedicatória recebida', texto);
        renderizarLista();
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'dedicatorias' },
      (payload) => {
        const index = itens.findIndex((i) => i.id === payload.new.id);
        if (index !== -1) itens[index] = payload.new;
        renderizarLista();
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'dedicatorias' },
      (payload) => {
        itens = itens.filter((i) => i.id !== payload.old.id);
        renderizarLista();
      }
    )
    .subscribe();
}

// ---------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------
(async function iniciar() {
  const autenticado = await protegerPagina();
  if (!autenticado) return;

  pedirPermissaoNotificacao();
  await carregarDedicatorias();
  iniciarRealtime();
})();
