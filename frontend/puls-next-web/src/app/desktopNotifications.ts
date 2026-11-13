/**
 * Системные оповещения браузера (в Windows — уведомления в правом нижнем углу экрана).
 * Браузеры дают их только в безопасном контексте: по HTTPS или на localhost.
 * На http://<ip>:порт API недоступен — тогда остаются оповещения внутри системы и звук.
 */
export type DesktopNotificationStatus = 'unsupported' | 'insecure' | 'default' | 'granted' | 'denied';

export const CHAT_OPEN_EVENT = 'puls-chat-open';

export function getDesktopNotificationStatus(): DesktopNotificationStatus {
  if (typeof window === 'undefined' || typeof window.Notification === 'undefined') {
    return window?.isSecureContext === false ? 'insecure' : 'unsupported';
  }

  if (window.isSecureContext === false) {
    return 'insecure';
  }

  return window.Notification.permission as DesktopNotificationStatus;
}

export async function requestDesktopNotificationPermission(): Promise<DesktopNotificationStatus> {
  const status = getDesktopNotificationStatus();
  if (status === 'unsupported' || status === 'insecure' || status === 'denied') {
    return status;
  }

  try {
    return (await window.Notification.requestPermission()) as DesktopNotificationStatus;
  } catch {
    return getDesktopNotificationStatus();
  }
}

/** Попросить приложение открыть диалог (обрабатывает ChatNotifications — он знает текущую страницу). */
export function requestOpenConversation(conversationId: number) {
  window.dispatchEvent(new CustomEvent<number>(CHAT_OPEN_EVENT, { detail: conversationId }));
}

export function showDesktopNotification(options: { title: string; body: string; conversationId: number }) {
  if (getDesktopNotificationStatus() !== 'granted') {
    return null;
  }

  try {
    const notification = new window.Notification(options.title, {
      body: options.body,
      // Одно оповещение на диалог: новое сообщение заменяет предыдущее, а не копит стопку.
      tag: `puls-chat-${options.conversationId}`,
      // Свой звук чат уже проигрывает — системный дублировать не нужно.
      silent: true
    });
    notification.onclick = () => {
      window.focus();
      requestOpenConversation(options.conversationId);
      notification.close();
    };
    return notification;
  } catch {
    return null;
  }
}
