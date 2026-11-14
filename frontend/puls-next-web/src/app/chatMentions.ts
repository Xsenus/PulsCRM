import type { ChatParticipantDto } from './chatTypes';

/** Сколько подсказок показывать при вводе «@». */
const MAX_SUGGESTIONS = 8;

function fold(value: string) {
  return value.toLowerCase().replace(/ё/g, 'е');
}

/** Упоминание, которое сейчас набирается перед курсором: «@» в начале слова и буквы после него. */
export function findMentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const match = /(^|\s)@([^\s@]{0,32})$/.exec(text.slice(0, caret));
  if (!match) {
    return null;
  }

  return { start: caret - match[2].length - 1, query: match[2] };
}

/** Участники для подсказки: кроме себя и уволенных; совпадение с началом любого слова имени или логина. */
export function getMentionCandidates(participants: ChatParticipantDto[], query: string, currentUserId: number) {
  const needle = fold(query);
  return participants
    .filter((participant) => participant.userId !== currentUserId && !participant.isInactive)
    .filter((participant) => !needle
      || fold(participant.displayName).split(/\s+/).some((word) => word.startsWith(needle))
      || fold(participant.login ?? '').startsWith(needle))
    .slice(0, MAX_SUGGESTIONS);
}

/** Подставляет «@Имя » вместо набранного «@запрос»; возвращает новый текст и позицию курсора. */
export function insertMention(text: string, start: number, caret: number, displayName: string) {
  const inserted = `@${displayName} `;
  return { text: `${text.slice(0, start)}${inserted}${text.slice(caret)}`, caret: start + inserted.length };
}

/** Кого упомянули: участники, чье «@Имя» есть в тексте (так же проверяет сервер). */
export function collectMentionedUserIds(text: string, participants: ChatParticipantDto[], currentUserId: number) {
  const folded = fold(text);
  return participants
    .filter((participant) => participant.userId !== currentUserId && !participant.isInactive)
    .filter((participant) => folded.includes(`@${fold(participant.displayName)}`))
    .map((participant) => participant.userId);
}

export type MentionPart = { type: 'text'; value: string } | { type: 'mention'; value: string; userId: number };

/** Делит текст на обычные куски и «@Имя» упомянутых сотрудников (длинные имена проверяются первыми). */
export function splitMentions(text: string, mentioned: Array<{ userId: number; name: string }>): MentionPart[] {
  if (mentioned.length === 0 || !text.includes('@')) {
    return [{ type: 'text', value: text }];
  }

  const names = [...mentioned].sort((a, b) => b.name.length - a.name.length);
  const folded = fold(text);
  const parts: MentionPart[] = [];
  let position = 0;
  let buffer = '';
  while (position < text.length) {
    const found = text[position] === '@'
      ? names.find((item) => folded.startsWith(`@${fold(item.name)}`, position))
      : undefined;
    if (found) {
      if (buffer) {
        parts.push({ type: 'text', value: buffer });
        buffer = '';
      }

      const length = found.name.length + 1;
      parts.push({ type: 'mention', value: text.slice(position, position + length), userId: found.userId });
      position += length;
    } else {
      buffer += text[position];
      position += 1;
    }
  }

  if (buffer) {
    parts.push({ type: 'text', value: buffer });
  }

  return parts;
}
