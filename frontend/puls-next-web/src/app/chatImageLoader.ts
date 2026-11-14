import { fetchChatAttachmentBlob } from './chatApi';

/**
 * Загрузка картинок чата. Картинки отдаются только с JWT, поэтому качаются как blob.
 * - Не больше MAX_PARALLEL загрузок одновременно: текст и API не ждут за десятком фото.
 * - Последний запрошенный — первым (LIFO): то, что пользователь видит сейчас, важнее того,
 *   мимо чего он уже пролистал. Ушедшие с экрана запросы, которые еще не начались, отменяются.
 * - Готовые object URL кэшируются; кэш ограничен, неиспользуемые освобождаются.
 */

export const MAX_PARALLEL = 4;
export const MAX_CACHED = 150;

type Key = string;

interface Entry {
  promise: Promise<string>;
  url: string | null;
  refs: number;
  lastUsed: number;
}

interface Pending {
  key: Key;
  start: () => void;
  cancelled: boolean;
}

const cache = new Map<Key, Entry>();
const queue: Pending[] = [];
let active = 0;

export function imageKey(attachmentId: number, thumbnail: boolean): Key {
  return `${attachmentId}:${thumbnail ? 'thumb' : 'full'}`;
}

function pump() {
  while (active < MAX_PARALLEL && queue.length > 0) {
    const next = queue.pop()!;
    if (next.cancelled) {
      continue;
    }

    active += 1;
    next.start();
  }
}

function evict() {
  if (cache.size <= MAX_CACHED) {
    return;
  }

  const idle = Array.from(cache.entries())
    .filter(([, entry]) => entry.refs === 0 && entry.url)
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  for (const [key, entry] of idle) {
    if (cache.size <= MAX_CACHED) {
      break;
    }

    URL.revokeObjectURL(entry.url!);
    cache.delete(key);
  }
}

/**
 * Берет картинку (из кэша или ставит в очередь). release() — картинка больше не нужна этому экрану:
 * еще не начатая загрузка отменяется, готовый URL остается в кэше до вытеснения.
 */
export function acquireChatImage(attachmentId: number, thumbnail: boolean): { promise: Promise<string>; release: () => void } {
  const key = imageKey(attachmentId, thumbnail);
  let entry = cache.get(key);
  let pending: Pending | null = null;

  if (!entry) {
    let resolve!: (url: string) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<string>((ok, fail) => {
      resolve = ok;
      reject = fail;
    });
    // Ошибку обрабатывают подписчики; без них не нужна «необработанная» ошибка в консоли.
    promise.catch(() => undefined);
    const created: Entry = { promise, url: null, refs: 0, lastUsed: Date.now() };
    entry = created;
    cache.set(key, created);
    pending = {
      key,
      cancelled: false,
      start: () => {
        fetchChatAttachmentBlob(attachmentId, true, thumbnail)
          .then((blob) => {
            created.url = URL.createObjectURL(blob);
            resolve(created.url);
            evict();
          })
          .catch((reason) => {
            cache.delete(key);
            reject(reason);
          })
          .finally(() => {
            active -= 1;
            pump();
          });
      }
    };
    queue.push(pending);
    pump();
  }

  const current = entry;
  current.refs += 1;
  current.lastUsed = Date.now();
  let released = false;

  return {
    promise: current.promise,
    release: () => {
      if (released) {
        return;
      }

      released = true;
      current.refs -= 1;
      current.lastUsed = Date.now();
      // Никому не нужна и еще не начала качаться — снимаем с очереди.
      if (current.refs === 0 && pending && !current.url) {
        const index = queue.indexOf(pending);
        if (index >= 0) {
          queue.splice(index, 1);
          pending.cancelled = true;
          cache.delete(key);
        }
      }

      evict();
    }
  };
}

/** Только для тестов. */
export function resetChatImageLoader() {
  cache.forEach((entry) => entry.url && URL.revokeObjectURL(entry.url));
  cache.clear();
  queue.length = 0;
  active = 0;
}

export function chatImageLoaderStats() {
  return { cached: cache.size, queued: queue.length, active };
}
