/**
 * Где сотрудник остановился в диалоге: первое видимое сообщение и его сдвиг от верха ленты.
 * Хранится в localStorage этого браузера; когда лента внизу — запись удаляется.
 */

const KEY_PREFIX = 'puls-chat-scroll';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface ChatScrollPosition {
  /** Первое (верхнее) видимое сообщение. */
  messageId: number;
  /** На сколько пикселей верх этого сообщения ниже верха ленты (может быть отрицательным). */
  offset: number;
}

function key(userId: number, conversationId: number) {
  return `${KEY_PREFIX}:${userId}:${conversationId}`;
}

export function loadChatScrollPosition(userId: number | null | undefined, conversationId: number): ChatScrollPosition | null {
  if (!userId) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key(userId, conversationId));
    if (!raw) {
      return null;
    }

    const value = JSON.parse(raw) as Partial<ChatScrollPosition & { savedAt: number }>;
    if (typeof value.messageId !== 'number' || value.messageId <= 0 || typeof value.offset !== 'number'
      || typeof value.savedAt !== 'number' || Date.now() - value.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(key(userId, conversationId));
      return null;
    }

    return { messageId: value.messageId, offset: value.offset };
  } catch {
    return null;
  }
}

/** null — лента внизу, запоминать нечего. */
export function saveChatScrollPosition(userId: number | null | undefined, conversationId: number, position: ChatScrollPosition | null) {
  if (!userId) {
    return;
  }

  try {
    if (position) {
      window.localStorage.setItem(key(userId, conversationId), JSON.stringify({ ...position, offset: Math.round(position.offset), savedAt: Date.now() }));
    } else {
      window.localStorage.removeItem(key(userId, conversationId));
    }
  } catch {
    // Хранилище недоступно (приватный режим) — просто не запоминаем.
  }
}
