// push.js
// Assinatura Web Push do administrador (alertas com o app fechado).
// A chave abaixo é a chave PÚBLICA VAPID (pode ficar no código).
// A chave privada fica só no banco (tabela config_privada).

import { supabase } from './supabase.js';

const VAPID_PUBLIC_KEY =
  'BEmf9RbODDTMzlQqMlJbWQVujkjbE86aj2tVB2v6XYuQOGCvvGhboN7w0yd3L8OEY5Iu_YbdJBAwXFlj_DpQzZ4';

function urlBase64ParaUint8Array(base64) {
  const preenchimento = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + preenchimento).replace(/-/g, '+').replace(/_/g, '/');
  const bruto = atob(b64);
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
}

export function pushSuportado() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function obterAssinatura() {
  const registro = await navigator.serviceWorker.ready;
  return { registro, assinatura: await registro.pushManager.getSubscription() };
}

async function salvarAssinatura(assinatura) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('sem-sessao');

  const json = assinatura.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 300),
    },
    { onConflict: 'endpoint' }
  );
  if (error) throw error;
}

// Estado para o botão: 'indisponivel' | 'bloqueado' | 'ativo' | 'inativo'
export async function estadoPush() {
  if (!pushSuportado()) return 'indisponivel';
  if (Notification.permission === 'denied') return 'bloqueado';
  const { assinatura } = await obterAssinatura();
  return assinatura && Notification.permission === 'granted' ? 'ativo' : 'inativo';
}

// Deve ser chamado a partir de um clique (exigência dos navegadores/iOS)
export async function ativarPush() {
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('permissao-negada');

  const { registro, assinatura: existente } = await obterAssinatura();
  const assinatura =
    existente ||
    (await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ParaUint8Array(VAPID_PUBLIC_KEY),
    }));

  await salvarAssinatura(assinatura);
}

export async function desativarPush() {
  const { assinatura } = await obterAssinatura();
  if (!assinatura) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', assinatura.endpoint);
  await assinatura.unsubscribe();
}

// Ao abrir o painel: se já está ativo, mantém o banco sincronizado
export async function sincronizarPush() {
  if ((await estadoPush()) !== 'ativo') return;
  const { assinatura } = await obterAssinatura();
  try {
    await salvarAssinatura(assinatura);
  } catch (e) {
    console.error('Falha ao sincronizar assinatura push', e);
  }
}
