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

// Tags permitidas no editor de rich text — mantém a formatação básica
// e é a mesma lista usada como whitelist do DOMPurify.
const TAGS_PERMITIDAS = ['b', 'i', 'u', 'strong', 'em', 'br', 'p'];

// ---------------------------------------------------------------
// Toolbar simples de formatação (negrito / itálico / sublinhado)
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

selectRelacao.addEventListener('change', () => {
  const mostrarOutro = selectRelacao.value === 'Outros';
  campoRelacaoOutro.hidden = !mostrarOutro;
  inputRelacaoOutro.required = mostrarOutro;
  if (!mostrarOutro) inputRelacaoOutro.value = '';
});

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
// Música tema — precisa de interação do usuário para tocar com som
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

  // Sanitização rigorosa do HTML digitado — remove qualquer coisa fora da whitelist
  // (scripts, atributos on*, iframes, etc). Isso é o que impede o XSS.
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

    mostrarStatus('Homenagem enviada! Obrigado por participar.', 'sucesso');
    form.reset();
    editor.innerHTML = '';
    midiaPreview.textContent = '';
  } catch (erro) {
    console.error(erro);
    mostrarStatus('Não foi possível enviar. Tente novamente.', 'erro');
  } finally {
    btnEnviar.disabled = false;
  }
});