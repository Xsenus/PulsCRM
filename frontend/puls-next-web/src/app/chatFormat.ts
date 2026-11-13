import type { ChatConversationDto, ChatMessageDto, ChatParticipantDto } from './chatTypes';
import { isSystemMessage } from './chatTypes';

const MINUTE = 60 * 1000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatChatTime(value: string) {
  return new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/** Время в списке диалогов: сегодня — часы, вчера — «вчера», на этой неделе — день недели, иначе дата. */
export function formatConversationTime(value: string, now = new Date()) {
  const date = new Date(value);
  if (sameDay(date, now)) {
    return formatChatTime(value);
  }

  const days = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / (24 * 60 * MINUTE));
  if (days === 1) {
    return 'вчера';
  }

  if (days > 1 && days < 7) {
    return date.toLocaleDateString('ru-RU', { weekday: 'short' });
  }

  return date.toLocaleDateString('ru-RU', date.getFullYear() === now.getFullYear()
    ? { day: 'numeric', month: 'short' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDaySeparator(value: string, now = new Date()) {
  const date = new Date(value);
  if (sameDay(date, now)) {
    return 'Сегодня';
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) {
    return 'Вчера';
  }

  return date.toLocaleDateString('ru-RU', date.getFullYear() === now.getFullYear()
    ? { day: 'numeric', month: 'long' }
    : { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} Б`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0).replace('.', ',')} КБ`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} МБ`;
}

export function getChatInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return (parts[0] ?? '?').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0d9488', '#16a34a', '#0891b2', '#9333ea', '#c2410c', '#4f46e5'];

export function getAvatarColor(seed: number | string) {
  const text = String(seed);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }

  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export type ChatTimelineItem =
  | { type: 'day'; key: string; label: string }
  | { type: 'message'; key: string; message: ChatMessageDto; showAuthor: boolean; isGroupEnd: boolean };

/**
 * Лента: разделители дней и группировка подряд идущих сообщений одного автора (в пределах 5 минут),
 * чтобы имя показывалось один раз, а «хвост» пузыря — у последнего.
 */
export function buildTimeline(messages: ChatMessageDto[], now = new Date()): ChatTimelineItem[] {
  const result: ChatTimelineItem[] = [];
  let previous: ChatMessageDto | null = null;

  messages.forEach((message, index) => {
    const date = new Date(message.createdAtUtc);
    if (!previous || !sameDay(new Date(previous.createdAtUtc), date)) {
      result.push({ type: 'day', key: `day-${startOfDay(date).getTime()}`, label: formatDaySeparator(message.createdAtUtc, now) });
      previous = null;
    }

    const next = messages[index + 1];
    const continues = (a: ChatMessageDto | null | undefined, b: ChatMessageDto | null | undefined) => !!a && !!b
      && !isSystemMessage(a) && !isSystemMessage(b)
      && a.senderUserId === b.senderUserId
      && sameDay(new Date(a.createdAtUtc), new Date(b.createdAtUtc))
      && Math.abs(new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime()) <= 5 * MINUTE;

    result.push({
      type: 'message',
      key: `m-${message.id}`,
      message,
      showAuthor: !continues(previous, message),
      isGroupEnd: !continues(message, next)
    });
    previous = message;
  });

  return result;
}

/** Слияние страниц и событий: без дублей, по возрастанию id. */
export function mergeMessages(current: ChatMessageDto[], incoming: ChatMessageDto[]) {
  const map = new Map<number, ChatMessageDto>();
  current.forEach((message) => map.set(message.id, message));
  incoming.forEach((message) => map.set(message.id, message));
  return Array.from(map.values()).sort((a, b) => a.id - b.id);
}

export function sortConversations(items: ChatConversationDto[]) {
  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }

    return new Date(b.lastMessageAtUtc).getTime() - new Date(a.lastMessageAtUtc).getTime();
  });
}

export function describeLastMessage(conversation: ChatConversationDto, currentUserId: number) {
  const message = conversation.lastMessage;
  if (!message) {
    return 'Нет сообщений';
  }

  if (message.isDeleted) {
    return 'Сообщение удалено';
  }

  if (isSystemMessage(message)) {
    return message.text ?? '';
  }

  const prefix = message.senderUserId === currentUserId
    ? 'Вы: '
    : conversation.kind === 'Group' || conversation.kind === 1 ? `${message.senderName.split(' ')[0]}: ` : '';
  const body = message.text?.trim()
    || (message.attachments.length === 1
      ? (message.attachments[0].isImage ? '🖼 Фото' : `📎 ${message.attachments[0].fileName}`)
      : message.attachments.length > 1 ? `📎 Файлы: ${message.attachments.length}` : '');
  return `${prefix}${body.replace(/\s+/g, ' ')}`;
}

/** Статус прочтения своего сообщения: «доставлено» или «прочитано» хотя бы одним собеседником. */
export function getReadStatus(message: ChatMessageDto, participants: ChatParticipantDto[], currentUserId: number) {
  const others = participants.filter((participant) => participant.userId !== currentUserId);
  if (others.length === 0) {
    return 'sent' as const;
  }

  return others.some((participant) => participant.lastReadMessageId >= message.id) ? 'read' as const : 'sent' as const;
}

export type TextPart = { type: 'text'; value: string } | { type: 'link'; value: string; href: string };

const LINK_PATTERN = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;

/** Разбивает текст на обычные куски и ссылки; ссылки ведут только на http(s). */
export function splitTextWithLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(LINK_PATTERN)) {
    const index = match.index ?? 0;
    let value = match[0];
    const trailing = value.match(/[.,;:!?)»]+$/)?.[0] ?? '';
    if (trailing) {
      value = value.slice(0, -trailing.length);
    }

    if (index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, index) });
    }

    parts.push({ type: 'link', value, href: value.toLowerCase().startsWith('www.') ? `https://${value}` : value });
    lastIndex = index + value.length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts;
}

/** Сообщение только из 1–3 эмодзи показывается крупно. */
export function isEmojiOnly(text?: string | null) {
  if (!text) {
    return false;
  }

  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 24) {
    return false;
  }

  const emoji = /^(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*\s*){1,3}$/u;
  return emoji.test(trimmed);
}

export function createClientMessageId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
