// admin-login.js
import { supabase } from './supabase.js';

const form = document.getElementById('form-login');
const statusEl = document.getElementById('login-status');
const btnEntrar = document.getElementById('btn-entrar');

function mostrarStatus(mensagem, tipo) {
  statusEl.textContent = mensagem;
  statusEl.className = `form-status ${tipo}`;
}

// Se já existe sessão válida, vai direto pro painel
supabase.auth.getSession().then(({ data }) => {
  if (data.session) {
    window.location.href = 'admin.html';
  }
});

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarStatus('', '');

  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value;

  if (!email || !senha) {
    mostrarStatus('Preencha e-mail e senha.', 'erro');
    return;
  }

  btnEntrar.disabled = true;
  mostrarStatus('Entrando...', '');

  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error) {
    mostrarStatus('E-mail ou senha inválidos.', 'erro');
    btnEntrar.disabled = false;
    return;
  }

  window.location.href = 'admin.html';
});