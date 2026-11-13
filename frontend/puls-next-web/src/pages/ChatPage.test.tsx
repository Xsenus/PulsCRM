/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatConversationDto, ChatMessageDto } from '../app/chatTypes';
import { ChatPage } from './ChatPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const apiMocks = vi.hoisted(() => ({
  getChatMessages: vi.fn(),
  sendChatMessage: vi.fn(),
  editChatMessage: vi.fn(),
  deleteChatMessage: vi.fn(),
  toggleChatReaction: vi.fn(),
  markChatRead: vi.fn(),
  updateChatPreferences: vi.fn(),
  uploadChatAttachment: vi.fn(),
  deletePendingChatAttachment: vi.fn(),
  fetchChatAttachmentBlob: vi.fn(),
  searchChatUsers: vi.fn(),
  openDirectChat: vi.fn(),
  createGroupChat: vi.fn(),
  updateGroupChat: vi.fn(),
  addChatMembers: vi.fn(),
  removeChatMember: vi.fn(),
  setChatMemberRole: vi.fn(),
  leaveChat: vi.fn()
}));

const chatState = vi.hoisted(() => ({ value: null as any }));

vi.mock('../app/chatApi', () => apiMocks);
vi.mock('../app/ChatContext', () => ({
  useChat: () => chatState.value,
  useOptionalChat: () => chatState.value
}));
vi.mock('../chat.css', () => ({}));

const ME = 1;
const PEER = 2;

function message(id: number, patch: Partial<ChatMessageDto> = {}): ChatMessageDto {
  return {
    id,
    conversationId: 10,
    kind: 0,
    senderUserId: PEER,
    senderName: 'Борис Петров',
    text: `Сообщение ${id}`,
    createdAtUtc: new Date().toISOString(),
    isDeleted: false,
    attachments: [],
    reactions: [],
    ...patch
  };
}

function conversation(patch: Partial<ChatConversationDto> = {}): ChatConversationDto {
  return {
    id: 10,
    kind: 0,
    title: 'Борис Петров',
    peerUserId: PEER,
    myRole: 0,
    isMuted: false,
    isPinned: false,
    isArchived: false,
    unreadCount: 1,
    myLastReadMessageId: 1,
    createdAtUtc: new Date().toISOString(),
    lastMessageAtUtc: new Date().toISOString(),
    lastMessage: message(2),
    participants: [
      { userId: ME, displayName: 'Алиса', role: 0, isInactive: false, lastReadMessageId: 1 },
      { userId: PEER, displayName: 'Борис Петров', role: 0, isInactive: false, lastReadMessageId: 3 }
    ],
    ...patch
  };
}

function createChat(patch: Record<string, unknown> = {}) {
  return {
    status: { enabled: true, currentUserId: ME, maxAttachmentBytes: 1024 * 1024, maxAttachmentsPerMessage: 3, maxMessageLength: 8000 },
    enabled: true,
    currentUserId: ME,
    connectionState: 'connected',
    conversations: [conversation()],
    conversationsLoaded: true,
    totalUnread: 1,
    settings: { notificationsEnabled: true, soundEnabled: true, soundName: 'chime', soundVolume: 70, showMessagePreview: true },
    onlineUserIds: new Set([PEER]),
    typingByConversation: {},
    notifications: [],
    activeConversationId: null,
    setActiveConversationId: vi.fn(),
    refreshConversations: vi.fn().mockResolvedValue(undefined),
    upsertConversation: vi.fn(),
    removeConversation: vi.fn(),
    markConversationReadLocally: vi.fn(),
    applyMessageLocally: vi.fn(),
    saveSettings: vi.fn(),
    dismissNotification: vi.fn(),
    sendTyping: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
    ...patch
  };
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(path: string) {
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container!);
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:conversationId" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>
    );
  });
  return container;
}

async function flush() {
  await act(async () => {
    for (let index = 0; index < 5; index += 1) {
      await Promise.resolve();
    }
  });
}

function setTextarea(value: string) {
  const textarea = container!.querySelector('textarea') as HTMLTextAreaElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  return textarea;
}

function pressKey(target: Element, key: string, init: KeyboardEventInit = {}) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  });
}

function buttonByLabel(label: string) {
  return container!.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
}

beforeEach(() => {
  chatState.value = createChat();
  apiMocks.getChatMessages.mockResolvedValue({ items: [message(1), message(2), message(3, { senderUserId: ME, senderName: 'Алиса' })], hasMoreBefore: false });
  apiMocks.markChatRead.mockResolvedValue(undefined);
  apiMocks.sendChatMessage.mockImplementation(async (_id: number, request: { text?: string; replyToMessageId?: number }) => message(50, {
    senderUserId: ME,
    senderName: 'Алиса',
    text: request.text,
    replyTo: request.replyToMessageId ? { id: request.replyToMessageId, senderUserId: PEER, senderName: 'Борис Петров', text: 'Сообщение 2', isDeleted: false, attachmentCount: 0 } : null
  }));
  apiMocks.editChatMessage.mockImplementation(async (id: number, text: string) => message(id, { senderUserId: ME, senderName: 'Алиса', text, editedAtUtc: new Date().toISOString() }));
  apiMocks.toggleChatReaction.mockImplementation(async (id: number, emoji: string) => message(id, { reactions: [{ emoji, count: 1, reactedByMe: true, userIds: [ME] }] }));
  apiMocks.searchChatUsers.mockResolvedValue([]);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('ChatPage', () => {
  it('shows disabled state when chat is off on the server', () => {
    chatState.value = createChat({ enabled: false, status: { enabled: false, currentUserId: ME, maxAttachmentBytes: 0, maxAttachmentsPerMessage: 0, maxMessageLength: 0 } });
    render('/chat');
    expect(container!.textContent).toContain('Чат пока отключен');
  });

  it('lists conversations with unread badge and last message', () => {
    render('/chat');
    const item = container!.querySelector('.chat-conversation-item')!;
    expect(item.textContent).toContain('Борис Петров');
    expect(item.textContent).toContain('Сообщение 2');
    expect(item.querySelector('.chat-unread-badge')?.textContent).toBe('1');
    expect(container!.textContent).toContain('Выберите диалог');
  });

  it('loads messages, shows unread divider, read ticks and marks conversation read', async () => {
    render('/chat/10');
    await flush();

    expect(apiMocks.getChatMessages).toHaveBeenCalledWith(10, undefined, 50);
    const bubbles = Array.from(container!.querySelectorAll('.chat-message'));
    expect(bubbles).toHaveLength(3);
    expect(container!.querySelector('.chat-unread-divider')?.textContent).toContain('Новые сообщения');
    expect(container!.querySelector('.chat-message.own .chat-ticks')?.textContent).toBe('✓✓');
    expect(container!.querySelector('.chat-view-subtitle')?.textContent).toBe('в сети');
    expect(apiMocks.markChatRead).toHaveBeenCalledWith(10, 3);
    expect(chatState.value.markConversationReadLocally).toHaveBeenCalledWith(10, 3);
  });

  it('sends message on Enter, keeps Shift+Enter for new line, and supports reply', async () => {
    render('/chat/10');
    await flush();

    const textarea = setTextarea('Первая строка');
    pressKey(textarea, 'Enter', { shiftKey: true });
    expect(apiMocks.sendChatMessage).not.toHaveBeenCalled();

    const secondMessage = container!.querySelectorAll('.chat-message')[1];
    act(() => {
      (secondMessage.querySelector('button[aria-label="Ответить"]') as HTMLButtonElement).click();
    });
    expect(container!.querySelector('.chat-composer-context')?.textContent).toContain('Ответ Борис Петров');

    pressKey(textarea, 'Enter');
    await flush();

    expect(apiMocks.sendChatMessage).toHaveBeenCalledWith(10, expect.objectContaining({ text: 'Первая строка', replyToMessageId: 2, attachmentIds: [] }));
    expect(apiMocks.sendChatMessage.mock.calls[0][1].clientMessageId).toBeTruthy();
    expect(chatState.value.applyMessageLocally).toHaveBeenCalled();
    expect(container!.querySelector('.chat-composer-context')).toBeNull();
    expect((container!.querySelector('textarea') as HTMLTextAreaElement).value).toBe('');
    expect(container!.textContent).toContain('Первая строка');
  });

  it('edits last own message with ArrowUp and saves on Enter', async () => {
    render('/chat/10');
    await flush();

    const textarea = container!.querySelector('textarea')!;
    pressKey(textarea, 'ArrowUp');
    expect(container!.querySelector('.chat-composer-context')?.textContent).toContain('Редактирование');
    expect((textarea as HTMLTextAreaElement).value).toBe('Сообщение 3');

    setTextarea('Исправленный текст');
    pressKey(textarea, 'Enter');
    await flush();

    expect(apiMocks.editChatMessage).toHaveBeenCalledWith(3, 'Исправленный текст');
    expect(container!.textContent).toContain('Исправленный текст');
    expect(container!.textContent).toContain('изменено');
  });

  it('keeps an unsent draft after leaving the conversation and shows it in the list', async () => {
    render('/chat/10');
    await flush();
    setTextarea('Недописанный ответ');
    act(() => root?.unmount());
    container?.remove();

    // В открытом диалоге черновик не дублируется в списке.
    render('/chat/10');
    await flush();
    expect((container!.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Недописанный ответ');
    expect(container!.querySelector('.chat-conversation-draft')).toBeNull();
    act(() => root?.unmount());
    container?.remove();

    render('/chat');
    await flush();
    expect(container!.querySelector('.chat-conversation-preview')?.textContent).toBe('Черновик: Недописанный ответ');
  });

  it('restores the draft after editing a message and clears it after sending', async () => {
    render('/chat/10');
    await flush();
    const textarea = setTextarea('Мой черновик');
    const ownMessage = container!.querySelectorAll('.chat-message')[2];
    act(() => (ownMessage.querySelector('button[aria-label="Еще"]') as HTMLButtonElement).click());
    act(() => {
      Array.from(ownMessage.querySelectorAll('button[role="menuitem"]')).find((button) => button.textContent === 'Изменить')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container!.querySelector('.chat-composer-context')?.textContent).toContain('Редактирование');
    expect(textarea.value).toBe('Сообщение 3');
    pressKey(textarea, 'Escape');
    expect(textarea.value).toBe('Мой черновик');

    setTextarea('Отправляю');
    pressKey(textarea, 'Enter');
    await flush();
    expect(textarea.value).toBe('');
    expect(window.localStorage.getItem('puls-chat-draft:1:10')).toBeNull();
  });

  it('toggles a quick reaction', async () => {
    render('/chat/10');
    await flush();

    const first = container!.querySelectorAll('.chat-message')[0];
    act(() => {
      (first.querySelector('button[aria-label="Реакция"]') as HTMLButtonElement).click();
    });
    act(() => {
      // jsdom не находит атрибуты с эмодзи через CSS-селектор, ищем вручную.
      Array.from(first.querySelectorAll('.chat-quick-reactions button'))
        .find((button) => button.getAttribute('aria-label') === 'Реакция 👍')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    expect(apiMocks.toggleChatReaction).toHaveBeenCalledWith(1, '👍');
    expect(container!.querySelector('.chat-reaction.mine')?.textContent).toContain('👍');
  });

  it('uploads attached files before sending and rejects oversized ones', async () => {
    apiMocks.uploadChatAttachment.mockResolvedValue({ id: 77, conversationId: 10, fileName: 'отчет.pdf', contentType: 'application/pdf', length: 3, isImage: false, uploadedAtUtc: '' });
    render('/chat/10');
    await flush();

    const input = container!.querySelector('input[type="file"]') as HTMLInputElement;
    const small = new File(['abc'], 'отчет.pdf', { type: 'application/pdf' });
    const big = new File([new Uint8Array(2 * 1024 * 1024)], 'big.bin');
    Object.defineProperty(input, 'files', { configurable: true, value: [small, big] });
    act(() => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flush();

    expect(apiMocks.uploadChatAttachment).toHaveBeenCalledTimes(1);
    expect(container!.querySelectorAll('.chat-upload')).toHaveLength(1);

    act(() => {
      buttonByLabel('Отправить')!.click();
    });
    await flush();

    expect(apiMocks.sendChatMessage).toHaveBeenCalledWith(10, expect.objectContaining({ attachmentIds: [77] }));
    expect(container!.querySelectorAll('.chat-upload')).toHaveLength(0);
  });

  it('blocks composer for a fired peer', async () => {
    chatState.value = createChat({
      conversations: [conversation({
        participants: [
          { userId: ME, displayName: 'Алиса', role: 0, isInactive: false, lastReadMessageId: 1 },
          { userId: PEER, displayName: 'Борис Петров', role: 0, isInactive: true, lastReadMessageId: 1 }
        ]
      })]
    });
    render('/chat/10');
    await flush();

    expect(container!.querySelector('textarea')).toBeNull();
    expect(container!.textContent).toContain('Сотрудник уволен');
  });
});
