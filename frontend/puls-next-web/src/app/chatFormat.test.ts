import { describe, expect, it } from 'vitest';
import {
  buildTimeline,
  describeLastMessage,
  formatConversationTime,
  formatDaySeparator,
  formatFileSize,
  getChatInitials,
  getReadStatus,
  isEmojiOnly,
  mergeMessages,
  sortConversations,
  splitTextWithLinks
} from './chatFormat';
import type { ChatConversationDto, ChatMessageDto } from './chatTypes';

function message(id: number, patch: Partial<ChatMessageDto> = {}): ChatMessageDto {
  return {
    id,
    conversationId: 1,
    kind: 0,
    senderUserId: 1,
    senderName: 'Алиса Иванова',
    text: `#${id}`,
    createdAtUtc: '2026-11-13T10:00:00Z',
    isDeleted: false,
    attachments: [],
    reactions: [],
    ...patch
  };
}

function conversation(id: number, patch: Partial<ChatConversationDto> = {}): ChatConversationDto {
  return {
    id,
    kind: 0,
    title: `Диалог ${id}`,
    myRole: 0,
    isMuted: false,
    isPinned: false,
    isArchived: false,
    unreadCount: 0,
    myLastReadMessageId: 0,
    createdAtUtc: '2026-11-01T00:00:00Z',
    lastMessageAtUtc: '2026-11-01T00:00:00Z',
    participants: [],
    ...patch
  };
}

describe('chatFormat', () => {
  it('formats conversation time relative to now', () => {
    const now = new Date(2026, 10, 13, 15, 0);
    expect(formatConversationTime(new Date(2026, 10, 13, 9, 5).toISOString(), now)).toMatch(/09:05/);
    expect(formatConversationTime(new Date(2026, 10, 12, 9, 5).toISOString(), now)).toBe('вчера');
    expect(formatDaySeparator(new Date(2026, 10, 13, 1, 0).toISOString(), now)).toBe('Сегодня');
    expect(formatDaySeparator(new Date(2026, 10, 12, 23, 0).toISOString(), now)).toBe('Вчера');
  });

  it('formats file sizes in Russian units', () => {
    expect(formatFileSize(512)).toBe('512 Б');
    expect(formatFileSize(1536)).toBe('1,5 КБ');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5,0 МБ');
  });

  it('builds initials from full name', () => {
    expect(getChatInitials('Иванова Алиса Петровна')).toBe('ИА');
    expect(getChatInitials('admin')).toBe('AD');
  });

  it('groups consecutive messages of one author and inserts day separators', () => {
    const items = buildTimeline([
      message(1, { createdAtUtc: new Date(2026, 10, 12, 10, 0).toISOString() }),
      message(2, { createdAtUtc: new Date(2026, 10, 13, 10, 0).toISOString() }),
      message(3, { createdAtUtc: new Date(2026, 10, 13, 10, 2).toISOString() }),
      message(4, { senderUserId: 2, createdAtUtc: new Date(2026, 10, 13, 10, 3).toISOString() }),
      message(5, { createdAtUtc: new Date(2026, 10, 13, 10, 30).toISOString() })
    ], new Date(2026, 10, 13, 12, 0));

    expect(items.map((item) => item.type === 'day' ? item.label : `${item.message.id}:${item.showAuthor ? 'A' : '-'}${item.isGroupEnd ? 'E' : ''}`))
      .toEqual(['Вчера', '1:AE', 'Сегодня', '2:A', '3:-E', '4:AE', '5:AE']);
  });

  it('merges pages without duplicates and keeps order', () => {
    const merged = mergeMessages([message(2), message(3)], [message(1), message(3, { text: 'обновлено' })]);
    expect(merged.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(merged[2].text).toBe('обновлено');
  });

  it('sorts pinned conversations first, then by last message', () => {
    const sorted = sortConversations([
      conversation(1, { lastMessageAtUtc: '2026-11-13T10:00:00Z' }),
      conversation(2, { lastMessageAtUtc: '2026-11-10T10:00:00Z', isPinned: true }),
      conversation(3, { lastMessageAtUtc: '2026-11-13T11:00:00Z' })
    ]);
    expect(sorted.map((item) => item.id)).toEqual([2, 3, 1]);
  });

  it('describes last message for the conversation list', () => {
    expect(describeLastMessage(conversation(1), 1)).toBe('Нет сообщений');
    expect(describeLastMessage(conversation(1, { lastMessage: message(1, { text: 'Привет' }) }), 1)).toBe('Вы: Привет');
    expect(describeLastMessage(conversation(1, { kind: 1, lastMessage: message(1, { senderUserId: 2, text: 'Готово' }) }), 1)).toBe('Алиса: Готово');
    expect(describeLastMessage(conversation(1, {
      lastMessage: message(1, {
        senderUserId: 2,
        text: null,
        attachments: [{ id: 1, conversationId: 1, fileName: 'a.png', contentType: 'image/png', length: 1, isImage: true, uploadedAtUtc: '' }]
      })
    }), 1)).toBe('🖼 Фото');
    expect(describeLastMessage(conversation(1, { lastMessage: message(1, { isDeleted: true }) }), 1)).toBe('Сообщение удалено');
  });

  it('marks own message as read when any other participant read it', () => {
    const participants = [
      { userId: 1, displayName: 'Я', role: 0 as const, isInactive: false, lastReadMessageId: 10 },
      { userId: 2, displayName: 'Борис', role: 0 as const, isInactive: false, lastReadMessageId: 4 }
    ];
    expect(getReadStatus(message(5), participants, 1)).toBe('sent');
    expect(getReadStatus(message(4), participants, 1)).toBe('read');
  });

  it('finds links without trailing punctuation and only http(s)', () => {
    expect(splitTextWithLinks('см. https://example.com/a?b=1, и www.test.ru.')).toEqual([
      { type: 'text', value: 'см. ' },
      { type: 'link', value: 'https://example.com/a?b=1', href: 'https://example.com/a?b=1' },
      { type: 'text', value: ', и ' },
      { type: 'link', value: 'www.test.ru', href: 'https://www.test.ru' },
      { type: 'text', value: '.' }
    ]);
    expect(splitTextWithLinks('javascript:alert(1)')).toEqual([{ type: 'text', value: 'javascript:alert(1)' }]);
  });

  it('detects emoji-only messages', () => {
    expect(isEmojiOnly('👍')).toBe(true);
    expect(isEmojiOnly('❤️🔥')).toBe(true);
    expect(isEmojiOnly('👍 ок')).toBe(false);
    expect(isEmojiOnly('12')).toBe(false);
  });
});
