import { api } from './api';

/**
 * Web Push: системные уведомления о сообщениях чата, даже когда вкладка CRM закрыта (браузер запущен).
 * Работает там же, где системные оповещения: HTTPS, localhost или адрес, разрешенный флагом/политикой браузера.
 */
export const CHAT_SERVICE_WORKER_URL = '/chat-sw.js';
export const SW_OPEN_CONVERSATION_MESSAGE = 'puls-chat-open';

let pushActive = false;

/** Подписка этого браузера действует — уведомления при скрытой вкладке показывает сервис-воркер. */
export function isWebPushActive() {
  return pushActive;
}

export function isWebPushSupported() {
  return typeof window !== 'undefined'
    && window.isSecureContext === true
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && typeof window.Notification !== 'undefined';
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function bytesToBase64Url(buffer: ArrayBuffer | null) {
  if (!buffer) {
    return '';
  }

  let binary = '';
  new Uint8Array(buffer).forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getRegistration() {
  await navigator.serviceWorker.register(CHAT_SERVICE_WORKER_URL, { scope: '/' });
  return navigator.serviceWorker.ready;
}

function sameKey(subscription: PushSubscription, applicationServerKey: Uint8Array) {
  const current = subscription.options?.applicationServerKey;
  if (!current) {
    return false;
  }

  const bytes = new Uint8Array(current);
  return bytes.length === applicationServerKey.length && bytes.every((byte, index) => byte === applicationServerKey[index]);
}

/**
 * Подписывает браузер (или обновляет подписку) и сохраняет ее на сервере. false — недоступно или нет разрешения.
 * Вызывается при каждом запуске: сервер узнает актуальный адрес, даже если браузер его сменил.
 */
export async function enableWebPush(): Promise<boolean> {
  if (!isWebPushSupported() || window.Notification.permission !== 'granted') {
    pushActive = false;
    return false;
  }

  try {
    const registration = await getRegistration();
    const { data } = await api.get<{ publicKey: string }>('/api/chat/push/public-key');
    const applicationServerKey = base64UrlToBytes(data.publicKey);

    let subscription = await registration.pushManager.getSubscription();
    if (subscription && !sameKey(subscription, applicationServerKey)) {
      // Ключ сервера сменился — старая подписка больше не примет уведомления.
      await subscription.unsubscribe();
      subscription = null;
    }

    subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    await api.post('/api/chat/push/subscriptions', {
      endpoint: subscription.endpoint,
      keys: { p256dh: bytesToBase64Url(subscription.getKey('p256dh')), auth: bytesToBase64Url(subscription.getKey('auth')) }
    });
    pushActive = true;
    return true;
  } catch {
    // Нет связи с сервисом push браузера или подписка запрещена — остаются оповещения на странице.
    pushActive = false;
    return false;
  }
}

/**
 * Отписывает браузер и удаляет подписку на сервере (системные оповещения выключены).
 * notifyServer: false — при выходе из системы: токена уже нет, а отписанный адрес сервер удалит сам,
 * когда сервис push ответит, что подписка недействительна.
 */
export async function disableWebPush({ notifyServer = true }: { notifyServer?: boolean } = {}): Promise<void> {
  pushActive = false;
  if (!isWebPushSupported()) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) {
      return;
    }

    if (notifyServer) {
      await api.delete('/api/chat/push/subscriptions', { data: { endpoint: subscription.endpoint } }).catch(() => undefined);
    }

    await subscription.unsubscribe();
  } catch {
    // Отписка не критична: сервер удалит подписку, когда сервис push ответит, что она недействительна.
  }
}

/** Приводит подписку в соответствие настройкам: включены системные оповещения — подписан. */
export function syncWebPush(enabled: boolean) {
  return enabled ? enableWebPush() : disableWebPush().then(() => false);
}
