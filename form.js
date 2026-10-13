// form.js
// Lógica do formulário de captação de dedicatórias.

import { supabase, BUCKET_MIDIAS } from './supabase.js';

const form = document.getElementById('form-dedicatoria');
const editor = document.getElementById('mensagem');
const statusEl = document.getElementById('form-status');
const btnEnviar = document.getElementById('btn-enviar');
const inputMidia = document.getElementById('midia');
const midiaPreview = document.getElementById('midia-preview');
const btnAudio = document.getElementById('btn-audio');
const musica = document.getElementById('musica-tema');

const TAGS_PERMITIDAS = ['b', 'i', 'u', 'strong', 'em', 'br', 'p', 'div'];

document.execCommand('defaultParagraphSeparator', false, 'p');

// ---------------------------------------------------------------
// Prova social: quantas homenagens já foram publicadas (aprovadas).
// Atualiza ao abrir, ao voltar para a aba e a cada 30 s.
// ---------------------------------------------------------------
async function carregarContador() {
  const contadorEl = document.getElementById('contador-homenagens');
  const labelEl = document.getElementById('hero-stats-label');
  if (!contadorEl || !labelEl) return;

  const { count, error } = await supabase
    .from('dedicatorias')
    .select('*', { count: 'exact', head: true })
    .eq('aprovado', true);

  if (error) {
    console.error(error);
    return;
  }

  contadorEl.textContent = count ?? 0;
  labelEl.textContent = count === 1
    ? 'pessoa já deixou uma homenagem'
    : 'pessoas já deixaram uma homenagem';
}

carregarContador();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') carregarContador();
});
setInterval(carregarContador, 30000);

// ---------------------------------------------------------------
// Toolbar simples de formatação
// ---------------------------------------------------------------
document.querySelectorAll('.editor-toolbar button').forEach((botao) => {
  botao.addEventListener('click', () => {
    document.execCommand(botao.dataset.cmd, false, null);
    editor.focus();
  });
});

// ---------------------------------------------------------------
// Campo "Outros" (relação com o homenageado)
// ---------------------------------------------------------------
const selectRelacao = document.getElementById('relacao');
const campoRelacaoOutro = document.getElementById('campo-relacao-outro');
const inputRelacaoOutro = document.getElementById('relacao-outro');

function atualizarCampoOutro() {
  const mostrarOutro = selectRelacao.value === 'Outros';
  campoRelacaoOutro.hidden = !mostrarOutro;
  inputRelacaoOutro.required = mostrarOutro;
  if (!mostrarOutro) inputRelacaoOutro.value = '';
}

selectRelacao.addEventListener('change', atualizarCampoOutro);

function obterRelacaoFinal() {
  if (selectRelacao.value === 'Outros') {
    return inputRelacaoOutro.value.trim();
  }
  return selectRelacao.value;
}

// ---------------------------------------------------------------
// Preview do arquivo selecionado
// ---------------------------------------------------------------
inputMidia.addEventListener('change', () => {
  const arquivo = inputMidia.files[0];
  midiaPreview.textContent = arquivo ? `Selecionado: ${arquivo.name}` : '';
});

// ---------------------------------------------------------------
// Música tema
// ---------------------------------------------------------------
btnAudio.addEventListener('click', () => {
  if (musica.paused) {
    musica
      .play()
      .then(() => { btnAudio.textContent = '🔊'; })
      .catch(() => { mostrarStatus('Não foi possível iniciar a música.', 'erro'); });
  } else {
    musica.pause();
    btnAudio.textContent = '🔇';
  }
});

function mostrarStatus(mensagem, tipo) {
  statusEl.textContent = mensagem;
  statusEl.className = `form-status ${tipo}`;
}

function detectarTipoMidia(arquivo) {
  if (!arquivo) return null;
  if (arquivo.type.startsWith('audio/')) return 'audio';
  if (arquivo.type.startsWith('image/')) return 'imagem';
  return null;
}

async function enviarMidiaParaStorage(arquivo) {
  const extensao = arquivo.name.split('.').pop();
  const nomeArquivo = `${crypto.randomUUID()}.${extensao}`;

  const { error: erroUpload } = await supabase
    .storage
    .from(BUCKET_MIDIAS)
    .upload(nomeArquivo, arquivo, { cacheControl: '3600', upsert: false });

  if (erroUpload) throw erroUpload;

  const { data } = supabase.storage.from(BUCKET_MIDIAS).getPublicUrl(nomeArquivo);
  return data.publicUrl;
}

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarStatus('', '');

  const nome = DOMPurify.sanitize(document.getElementById('nome').value.trim(), { ALLOWED_TAGS: [] });
  const relacao = DOMPurify.sanitize(obterRelacaoFinal(), { ALLOWED_TAGS: [] });
  const mensagemTexto = editor.textContent.trim();

  const mensagemHtml = DOMPurify.sanitize(editor.innerHTML, {
    ALLOWED_TAGS: TAGS_PERMITIDAS,
    ALLOWED_ATTR: [],
  });

  const arquivo = inputMidia.files[0];

  if (!nome || !relacao || !mensagemTexto) {
    mostrarStatus('Preencha nome, relação e mensagem.', 'erro');
    return;
  }

  btnEnviar.disabled = true;
  mostrarStatus('Enviando...', '');

  try {
    let midiaUrl = null;
    const midiaTipo = detectarTipoMidia(arquivo);

    if (arquivo) {
      midiaUrl = await enviarMidiaParaStorage(arquivo);
    }

    const { error } = await supabase.from('dedicatorias').insert({
      nome,
      relacao,
      mensagem: mensagemHtml,
      midia_url: midiaUrl,
      midia_tipo: midiaTipo,
    });

    if (error) throw error;

    mostrarStatus(
      'Homenagem enviada! Ela aparecerá no mural assim que for aprovada. Obrigado por participar.',
      'sucesso'
    );
    form.reset();
    editor.innerHTML = '';
    midiaPreview.textContent = '';
    atualizarCampoOutro(); // form.reset() não dispara "change": esconde o campo "Qual?"
  } catch (erro) {
    console.error(erro);
    mostrarStatus('Não foi possível enviar. Tente novamente.', 'erro');
  } finally {
    btnEnviar.disabled = false;
  }
});
