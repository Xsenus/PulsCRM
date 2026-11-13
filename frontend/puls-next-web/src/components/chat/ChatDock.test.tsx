/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatConversationDto } from '../../app/chatTypes';
import { ChatDock } from './ChatDock';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const apiMocks = vi.hoisted(() => ({
  getChatMessages: vi.fn(),
  markChatRead: vi.fn(),
  searchChatUsers: vi.fn()
}));
const chatState = vi.hoisted(() => ({ value: null as any }));

vi.mock('../../app/chatApi', () => apiMocks);
vi.mock('../../app/ChatContext', () => ({
  useChat: () => chatState.value,
  useOptionalChat: () => chatState.value
}));
vi.mock('../../chat.css', () => ({}));

function conversation(id: number, title: string, unreadCount = 0): ChatConversationDto {
  return {
    id,
    kind: 0,
    title,
    peerUserId: id + 100,
    myRole: 0,
    isMuted: false,
    isPinned: false,
    isArchived: false,
    unreadCount,
    myLastReadMessageId: 0,
    createdAtUtc: new Date().toISOString(),
    lastMessageAtUtc: new Date().toISOString(),
    participants: [
      { userId: 1, displayName: 'Я', role: 0, isInactive: false, lastReadMessageId: 0 },
      { userId: id + 100, displayName: title, role: 0, isInactive: false, lastReadMessageId: 0 }
    ]
  };
}

function createChat(patch: Record<string, unknown> = {}) {
  const state: any = {
    status: { enabled: true, currentUserId: 1, maxAttachmentBytes: 1024, maxAttachmentsPerMessage: 3, maxMessageLength: 8000 },
    enabled: true,
    currentUserId: 1,
    connectionState: 'connected',
    conversations: [conversation(10, 'Петрова Анна', 2), conversation(11, 'Иванов Олег')],
    conversationsLoaded: true,
    totalUnread: 2,
    onlineUserIds: new Set<number>(),
    typingByConversation: {},
    notifications: [],
    dock: { open: false, conversationId: null },
    setActiveConversationId: vi.fn(),
    markConversationReadLocally: vi.fn(),
    applyMessageLocally: vi.fn(),
    upsertConversation: vi.fn(),
    removeConversation: vi.fn(),
    sendTyping: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
    ...patch
  };
  state.openDock = vi.fn((conversationId?: number | null) => {
    state.dock = { open: true, conversationId: conversationId === undefined ? state.dock.conversationId : conversationId };
    rerender();
  });
  state.minimizeDock = vi.fn(() => {
    state.dock = { ...state.dock, open: false };
    rerender();
  });
  return state;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let currentPath = '/';

function LocationProbe() {
  currentPath = useLocation().pathname;
  return null;
}

function tree(path: string) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<><ChatDock /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>
  );
}

let lastPath = '/';
function render(path = '/employees') {
  lastPath = path;
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container!);
    root.render(tree(path));
  });
}

function rerender() {
  // Состояние окна живет в замоканном контексте — перерисовываем дерево вручную.
  act(() => root?.render(tree(lastPath)));
}

async function flush() {
  await act(async () => {
    for (let index = 0; index < 5; index += 1) {
      await Promise.resolve();
    }
  });
}

function click(label: string) {
  const button = document.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
  expect(button, label).not.toBeNull();
  act(() => button!.click());
}

beforeEach(() => {
  chatState.value = createChat();
  apiMocks.getChatMessages.mockResolvedValue({ items: [], hasMoreBefore: false });
  apiMocks.markChatRead.mockResolvedValue(undefined);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.clearAllMocks();
});

describe('ChatDock', () => {
  it('is hidden when chat is disabled or on the chat page itself', () => {
    chatState.value = createChat({ enabled: false });
    render('/employees');
    expect(container!.innerHTML).toBe('');
    act(() => root?.unmount());
    container?.remove();

    chatState.value = createChat();
    render('/chat/10');
    expect(document.querySelector('.chat-dock-fab')).toBeNull();
  });

  it('shows a floating button with unread counter and opens the list', () => {
    render('/employees');
    const fab = document.querySelector('.chat-dock-fab')!;
    expect(fab.querySelector('.chat-dock-fab-badge')?.textContent).toBe('2');

    act(() => (fab as HTMLButtonElement).click());
    expect(chatState.value.openDock).toHaveBeenCalled();
    expect(document.querySelectorAll('.chat-dock .chat-conversation-item')).toHaveLength(2);
    expect(currentPath).toBe('/employees');
  });

  it('opens a conversation inside the window, marks it active and goes back to the list', async () => {
    chatState.value = createChat({ dock: { open: true, conversationId: null } });
    render('/organizations');

    const item = Array.from(document.querySelectorAll('.chat-dock .chat-conversation-item')).find((element) => element.textContent?.includes('Петрова'))!;
    act(() => (item as HTMLButtonElement).click());
    await flush();

    expect(chatState.value.openDock).toHaveBeenCalledWith(10);
    expect(document.querySelector('.chat-dock .chat-view-compact .chat-view-name')?.textContent).toBe('Петрова Анна');
    expect(apiMocks.getChatMessages).toHaveBeenCalledWith(10, undefined, 50);
    expect(chatState.value.setActiveConversationId).toHaveBeenCalledWith(10);
    expect(currentPath).toBe('/organizations');

    click('К списку диалогов');
    expect(chatState.value.openDock).toHaveBeenLastCalledWith(null);
    expect(document.querySelectorAll('.chat-dock .chat-conversation-item')).toHaveLength(2);
  });

  it('minimizes and expands to the full chat page', async () => {
    chatState.value = createChat({ dock: { open: true, conversationId: 11 } });
    render('/campaigns');
    await flush();

    click('Свернуть чат');
    expect(chatState.value.minimizeDock).toHaveBeenCalled();
    expect(document.querySelector('.chat-dock')).toBeNull();
    expect(document.querySelector('.chat-dock-fab')).not.toBeNull();

    chatState.value.dock = { open: true, conversationId: 11 };
    rerender();
    await flush();
    click('Открыть на всю страницу');
    expect(currentPath).toBe('/chat/11');
  });
});
