import { useEffect, useState } from 'react';

/**
 * Черновики сообщений: недописанный текст остается в диалоге при переходе в другой диалог,
 * на другую страницу и после перезагрузки. Хранятся в localStorage этого браузера,
 * отдельно для каждого пользователя.
 */

const KEY_PREFIX = 'puls-chat-draft';
const CHANGE_EVENT = 'puls-chat-draft-change';
/** Черновики старше месяца считаются забытыми и не показываются. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredDraft {
  text: string;
  savedAt: number;
}

function draftKey(userId: number, conversationId: number) {
  return `${KEY_PREFIX}:${userId}:${conversationId}`;
}

export function loadChatDraft(userId: number | null | undefined, conversationId: number): string {
  if (!userId) {
    return '';
  }

  try {
    const raw = window.localStorage.getItem(draftKey(userId, conversationId));
    if (!raw) {
      return '';
    }

    const draft = JSON.parse(raw) as Partial<StoredDraft>;
    if (typeof draft.text !== 'string' || typeof draft.savedAt !== 'number' || Date.now() - draft.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(draftKey(userId, conversationId));
      return '';
    }

    return draft.text;
  } catch {
    return '';
  }
}

export function saveChatDraft(userId: number | null | undefined, conversationId: number, text: string) {
  if (!userId) {
    return;
  }

  const key = draftKey(userId, conversationId);
  try {
    if (text.trim()) {
      window.localStorage.setItem(key, JSON.stringify({ text, savedAt: Date.now() } satisfies StoredDraft));
    } else if (window.localStorage.getItem(key) !== null) {
      window.localStorage.removeItem(key);
    } else {
      return;
    }
  } catch {
    return;
  }

  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { conversationId } }));
}

/** Текущий черновик диалога для списка диалогов; обновляется при изменении в этой и других вкладках. */
export function useChatDraft(userId: number | null | undefined, conversationId: number) {
  const [draft, setDraft] = useState(() => loadChatDraft(userId, conversationId));

  useEffect(() => {
    const refresh = () => setDraft(loadChatDraft(userId, conversationId));
    refresh();
    const handleChange = (event: Event) => {
      if ((event as CustomEvent<{ conversationId: number }>).detail?.conversationId === conversationId) {
        refresh();
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === draftKey(userId ?? 0, conversationId)) {
        refresh();
      }
    };

    window.addEventListener(CHANGE_EVENT, handleChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handleChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, [userId, conversationId]);

  return draft;
}
