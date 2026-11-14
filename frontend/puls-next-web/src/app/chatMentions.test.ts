import { describe, expect, it } from 'vitest';
import type { ChatParticipantDto } from './chatTypes';
import { collectMentionedUserIds, findMentionQuery, getMentionCandidates, insertMention, splitMentions } from './chatMentions';

const participants: ChatParticipantDto[] = [
  { userId: 1, displayName: 'Алиса Смирнова', login: 'alice', role: 0, isInactive: false, lastReadMessageId: 0 },
  { userId: 2, displayName: 'Борис Петров', login: 'bpetrov', role: 0, isInactive: false, lastReadMessageId: 0 },
  { userId: 3, displayName: 'Борис Петров-Водкин', login: 'bvodkin', role: 0, isInactive: false, lastReadMessageId: 0 },
  { userId: 4, displayName: 'Семён Уволенный', login: 'fired', role: 0, isInactive: true, lastReadMessageId: 0 }
];

describe('chat mentions', () => {
  it('detects the mention being typed before the caret', () => {
    expect(findMentionQuery('Привет, @бор', 12)).toEqual({ start: 8, query: 'бор' });
    expect(findMentionQuery('@', 1)).toEqual({ start: 0, query: '' });
    expect(findMentionQuery('почта a@b', 9)).toBeNull();
    expect(findMentionQuery('@борис петров', 13)).toBeNull();
  });

  it('suggests active participants except me by any word or login', () => {
    expect(getMentionCandidates(participants, 'пет', 1).map((item) => item.userId)).toEqual([2, 3]);
    expect(getMentionCandidates(participants, 'BVOD', 1).map((item) => item.userId)).toEqual([3]);
    expect(getMentionCandidates(participants, 'сем', 1)).toEqual([]);
    expect(getMentionCandidates(participants, '', 2).map((item) => item.userId)).toEqual([1, 3]);
  });

  it('inserts the full name and collects mentioned ids', () => {
    const result = insertMention('Привет, @бор как дела', 8, 12, 'Борис Петров');
    expect(result).toEqual({ text: 'Привет, @Борис Петров  как дела', caret: 22 });
    expect(collectMentionedUserIds(result.text, participants, 1)).toEqual([2]);
    expect(collectMentionedUserIds('@Алиса Смирнова и @семён уволенный', participants, 2)).toEqual([1]);
  });

  it('splits text into mention parts preferring the longest name', () => {
    const parts = splitMentions('Коллеги @Борис Петров-Водкин и @борис петров, гляньте', [
      { userId: 2, name: 'Борис Петров' },
      { userId: 3, name: 'Борис Петров-Водкин' }
    ]);
    expect(parts).toEqual([
      { type: 'text', value: 'Коллеги ' },
      { type: 'mention', value: '@Борис Петров-Водкин', userId: 3 },
      { type: 'text', value: ' и ' },
      { type: 'mention', value: '@борис петров', userId: 2 },
      { type: 'text', value: ', гляньте' }
    ]);
  });
});
