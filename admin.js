// admin.js
import { supabase, BUCKET_MIDIAS } from './supabase.js';
import { pushSuportado, estadoPush, ativarPush, desativarPush, sincronizarPush } from './push.js';

const TAGS_PERMITIDAS = ['b', 'i', 'u', 'strong', 'em', 'br', 'p', 'div'];

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
function notificarSistema(titulo, corpo, id) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    // Mesma tag usada pelo push do servidor: se os dois chegarem, um substitui o outro.
    new Notification(titulo, { body: corpo, icon: 'icon-192.png', tag: id ? `dedicatoria-${id}` : undefined });
  } catch (e) {
    // Alguns navegadores móveis exigem Service Worker para notificar; ignora.
  }
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
// Toasts
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

// ---------------------------------------------------------------
// Alertas push (notificação no aparelho, mesmo com o app fechado)
// ---------------------------------------------------------------
const btnPush = document.getElementById('btn-push');

async function atualizarBotaoPush() {
  if (!btnPush) return;
  const estado = await estadoPush();
  btnPush.disabled = false;
  btnPush.classList.toggle('ativo', estado === 'ativo');

  if (estado === 'indisponivel') {
    btnPush.textContent = '🔕 Alertas indisponíveis';
    btnPush.disabled = true;
    btnPush.title = 'Este navegador não suporta alertas push. No iPhone, instale o app na Tela de Início (Compartilhar → Adicionar à Tela de Início) e abra por lá.';
  } else if (estado === 'bloqueado') {
    btnPush.textContent = '🔕 Alertas bloqueados';
    btnPush.disabled = true;
    btnPush.title = 'As notificações estão bloqueadas. Libere nas configurações do site/navegador e recarregue.';
  } else if (estado === 'ativo') {
    btnPush.textContent = '🔔 Alertas ativos';
    btnPush.title = 'Toque para desativar os alertas neste aparelho';
  } else {
    btnPush.textContent = '🔕 Ativar alertas';
    btnPush.title = 'Receber uma notificação no aparelho a cada nova homenagem';
  }
}

if (btnPush) {
  btnPush.addEventListener('click', async () => {
    btnPush.disabled = true;
    try {
      if ((await estadoPush()) === 'ativo') {
        await desativarPush();
        mostrarToast('Alertas desativados neste aparelho.');
      } else {
        await ativarPush();
        mostrarToast('Alertas ativados! Você será avisado a cada nova homenagem.');
      }
    } catch (erro) {
      console.error(erro);
      mostrarToast(
        erro.message === 'permissao-negada'
          ? 'Permissão negada. Libere as notificações nas configurações do navegador.'
          : 'Não foi possível configurar os alertas. Tente novamente.'
      );
    }
    await atualizarBotaoPush();
  });
}

// ---------------------------------------------------------------
// Painel de notificações: abre/fecha SOMENTE por clique
// (depende da regra [hidden]{display:none!important} no style.css)
// ---------------------------------------------------------------
function fecharPainel() {
  painelNotificacoesEl.hidden = true;
  btnSino.setAttribute('aria-expanded', 'false');
}

function abrirPainel() {
  painelNotificacoesEl.hidden = false;
  btnSino.setAttribute('aria-expanded', 'true');
  naoLidas = 0;
  atualizarBadge();
}

btnSino.setAttribute('aria-expanded', 'false');
btnSino.addEventListener('click', (evento) => {
  evento.stopPropagation();
  if (painelNotificacoesEl.hidden) abrirPainel();
  else fecharPainel();
});

// Fecha ao clicar fora ou apertar Esc
document.addEventListener('click', (evento) => {
  if (painelNotificacoesEl.hidden) return;
  if (evento.target.closest('.wrapper-notificacoes')) return;
  fecharPainel();
});

document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape' && !painelNotificacoesEl.hidden) fecharPainel();
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

// nome e relacao vêm de input livre: NUNCA tratar como HTML confiável.
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
    return `<div class="midia-item"><img src="${url}" alt="Imagem enviada por ${nomeSeguro}"></div>`;
  }
  if (item.midia_tipo === 'audio') {
    return `<div class="midia-item"><audio controls src="${url}"></audio></div>`;
  }
  return '';
}

// Há algum card em modo de edição? Se sim, não re-renderizamos a lista
// (senão o texto que o admin está editando seria perdido).
function editandoAgora() {
  return !!listaEl.querySelector('.item-mensagem.editando');
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
        <span class="item-data">
          ${formatarData(item.criado_em)}
          <span class="item-ip" title="${escaparHtml(item.user_agent || 'user-agent não capturado')}">· IP: ${escaparHtml(item.ip_remetente || 'desconhecido')}</span>
        </span>
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

  const checkbox = evento.target;
  const card = checkbox.closest('.item-dedicatoria');
  const id = card.dataset.id;
  const aprovado = checkbox.checked;

  checkbox.disabled = true;

  // .select() devolve as linhas realmente alteradas. Se o RLS bloquear,
  // o Supabase NÃO dá erro: apenas altera 0 linhas. Detectamos isso aqui.
  const { data, error } = await supabase
    .from('dedicatorias')
    .update({ aprovado })
    .eq('id', id)
    .select('id, aprovado');

  checkbox.disabled = false;

  if (error || !data || data.length === 0) {
    mostrarToast(
      error
        ? 'Não foi possível atualizar a aprovação.'
        : 'A aprovação não foi gravada (permissão negada ou sessão expirada). Saia e entre de novo.'
    );
    checkbox.checked = !aprovado;
    console.error(error || 'update afetou 0 linhas (RLS/GRANT)');
    return;
  }

  const item = itens.find((i) => i.id === id);
  if (item) item.aprovado = data[0].aprovado;

  mostrarToast(aprovado ? 'Dedicatória aprovada e publicada no mural.' : 'Aprovação removida do mural.');
  if (!editandoAgora()) renderizarLista();
});

listaEl.addEventListener('click', async (evento) => {
  const card = evento.target.closest('.item-dedicatoria');
  if (!card) return;
  const id = card.dataset.id;

  // Entrar em modo de edição
  if (evento.target.classList.contains('btn-editar')) {
    const mensagemEl = card.querySelector('[data-campo="mensagem"]');
    mensagemEl.contentEditable = 'true';
    document.execCommand('defaultParagraphSeparator', false, 'p');
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

    const { data, error } = await supabase
      .from('dedicatorias')
      .update({ mensagem: mensagemSanitizada })
      .eq('id', id)
      .select('id');

    if (error || !data || data.length === 0) {
      mostrarToast('Não foi possível salvar a edição.');
      console.error(error || 'update afetou 0 linhas (RLS/GRANT)');
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

    const { data, error } = await supabase
      .from('dedicatorias')
      .delete()
      .eq('id', id)
      .select('id');

    if (error || !data || data.length === 0) {
      mostrarToast('Não foi possível excluir.');
      console.error(error || 'delete afetou 0 linhas (RLS/GRANT)');
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
// Notificações em tempo real
// ---------------------------------------------------------------
function iniciarRealtime() {
  supabase
    .channel('dedicatorias-admin')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'dedicatorias' },
      (payload) => {
        if (itens.some((i) => i.id === payload.new.id)) return; // evita duplicar
        itens.unshift(payload.new);
        naoLidas += 1;
        atualizarBadge();
        const texto = `Nova dedicatória de ${payload.new.nome}!`;
        mostrarToast(texto);
        adicionarNotificacao(texto);
        notificarSistema('Nova dedicatória recebida', texto, payload.new.id);
        if (!editandoAgora()) renderizarLista();
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'dedicatorias' },
      (payload) => {
        const index = itens.findIndex((i) => i.id === payload.new.id);
        if (index !== -1) itens[index] = payload.new;
        if (!editandoAgora()) renderizarLista();
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'dedicatorias' },
      (payload) => {
        itens = itens.filter((i) => i.id !== payload.old.id);
        if (!editandoAgora()) renderizarLista();
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

  await carregarDedicatorias();
  iniciarRealtime();
  if (pushSuportado()) await sincronizarPush();
  await atualizarBotaoPush();
})();
