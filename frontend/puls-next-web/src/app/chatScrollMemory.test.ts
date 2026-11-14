/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadChatScrollPosition, saveChatScrollPosition } from './chatScrollMemory';

describe('chat scroll memory', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it('keeps the position per user and conversation and forgets it at the bottom', () => {
    saveChatScrollPosition(1, 10, { messageId: 42, offset: 17.6 });
    expect(loadChatScrollPosition(1, 10)).toEqual({ messageId: 42, offset: 18 });
    expect(loadChatScrollPosition(2, 10)).toBeNull();
    expect(loadChatScrollPosition(1, 11)).toBeNull();

    saveChatScrollPosition(1, 10, null);
    expect(loadChatScrollPosition(1, 10)).toBeNull();
  });

  it('ignores stale and broken entries', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    saveChatScrollPosition(1, 10, { messageId: 5, offset: 0 });
    vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));
    expect(loadChatScrollPosition(1, 10)).toBeNull();

    window.localStorage.setItem('puls-chat-scroll:1:12', '{oops');
    expect(loadChatScrollPosition(1, 12)).toBeNull();
  });
});
