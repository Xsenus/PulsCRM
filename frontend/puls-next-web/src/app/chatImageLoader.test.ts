/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({ fetchChatAttachmentBlob: vi.fn() }));
vi.mock('./chatApi', () => apiMocks);

import { acquireChatImage, chatImageLoaderStats, MAX_PARALLEL, resetChatImageLoader } from './chatImageLoader';

type Deferred = { resolve: (blob: Blob) => void; reject: (reason: unknown) => void; id: number };

describe('chat image loader', () => {
  let requests: Deferred[];

  beforeEach(() => {
    requests = [];
    let counter = 0;
    globalThis.URL.createObjectURL = vi.fn(() => `blob:${++counter}`);
    globalThis.URL.revokeObjectURL = vi.fn();
    apiMocks.fetchChatAttachmentBlob.mockImplementation((id: number) => new Promise<Blob>((resolve, reject) => requests.push({ id, resolve, reject })));
  });

  afterEach(() => {
    resetChatImageLoader();
    vi.clearAllMocks();
  });

  it('limits parallel downloads and starts the most recently requested first', async () => {
    for (let id = 1; id <= 7; id += 1) {
      acquireChatImage(id, true);
    }

    expect(requests.map((item) => item.id)).toEqual([1, 2, 3, 4]);
    expect(requests).toHaveLength(MAX_PARALLEL);
    expect(chatImageLoaderStats().queued).toBe(3);

    requests[0].resolve(new Blob(['x']));
    await vi.waitFor(() => expect(requests).toHaveLength(5));
    // Освободившееся место получает последний запрошенный.
    expect(requests[4].id).toBe(7);
  });

  it('reuses the cached URL and cancels downloads nobody needs anymore', async () => {
    const first = acquireChatImage(1, true);
    requests[0].resolve(new Blob(['x']));
    await expect(first.promise).resolves.toBe('blob:1');
    first.release();

    const again = acquireChatImage(1, true);
    await expect(again.promise).resolves.toBe('blob:1');
    expect(apiMocks.fetchChatAttachmentBlob).toHaveBeenCalledTimes(1);

    for (let id = 2; id <= 5; id += 1) {
      acquireChatImage(id, true);
    }

    // Очередь полна: шестая ждет; пролистали мимо — снимается и не качается.
    const skipped = acquireChatImage(6, true);
    expect(chatImageLoaderStats().queued).toBe(1);
    skipped.release();
    expect(chatImageLoaderStats().queued).toBe(0);
    requests.slice(1).forEach((item) => item.resolve(new Blob(['x'])));
    await vi.waitFor(() => expect(chatImageLoaderStats().active).toBe(0));
    expect(apiMocks.fetchChatAttachmentBlob).not.toHaveBeenCalledWith(6, true, true);
  });

  it('forgets failed downloads so they can be retried', async () => {
    const failed = acquireChatImage(9, false);
    requests[0].reject(new Error('500'));
    await expect(failed.promise).rejects.toThrow('500');
    failed.release();

    acquireChatImage(9, false);
    expect(apiMocks.fetchChatAttachmentBlob).toHaveBeenCalledTimes(2);
  });
});
