/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadChatDraft, saveChatDraft } from './chatDrafts';

describe('chat drafts', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it('keeps drafts per user and conversation', () => {
    saveChatDraft(1, 10, 'Привет, по договору');
    saveChatDraft(2, 10, 'Чужой черновик');

    expect(loadChatDraft(1, 10)).toBe('Привет, по договору');
    expect(loadChatDraft(1, 11)).toBe('');
    expect(loadChatDraft(2, 10)).toBe('Чужой черновик');
    expect(loadChatDraft(null, 10)).toBe('');
  });

  it('removes the draft when the text is cleared and notifies listeners', () => {
    const listener = vi.fn();
    window.addEventListener('puls-chat-draft-change', listener);
    saveChatDraft(1, 10, 'Текст');
    saveChatDraft(1, 10, '   ');

    expect(loadChatDraft(1, 10)).toBe('');
    expect(window.localStorage.length).toBe(0);
    expect(listener).toHaveBeenCalledTimes(2);

    // Повторная очистка пустого черновика не будит список диалогов.
    saveChatDraft(1, 10, '');
    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener('puls-chat-draft-change', listener);
  });

  it('forgets drafts older than a month and survives broken storage', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    saveChatDraft(1, 10, 'Старый');
    vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));
    expect(loadChatDraft(1, 10)).toBe('');

    window.localStorage.setItem('puls-chat-draft:1:12', '{not json');
    expect(loadChatDraft(1, 12)).toBe('');
  });
});
