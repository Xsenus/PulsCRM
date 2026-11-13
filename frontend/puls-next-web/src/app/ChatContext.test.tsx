/** @vitest-environment jsdom */
import React, { useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatConversationDto, ChatMessageDto } from './chatTypes';
import { ChatProvider, useChat } from './ChatContext';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const hub = vi.hoisted(() => ({
  handlers: new Map<string, (payload: any) => void>(),
  invoke: vi.fn(),
  start: vi.fn(),
  stop: vi.fn()
}));

vi.mock('@microsoft/signalr', () => {
  class FakeBuilder {
    withUrl() { return this; }
    withAutomaticReconnect() { return this; }
    configureLogging() { return this; }
    build() {
      return {
        state: 'Connected',
        on: (name: string, handler: (payload: any) => void) => hub.handlers.set(name, handler),
        onreconnecting: () => undefined,
        onreconnected: () => undefined,
        onclose: () => undefined,
        start: hub.start,
        stop: hub.stop,
        invoke: hub.invoke
      };
    }
  }

  return {
    HubConnectionBuilder: FakeBuilder,
    HubConnectionState: { Connected: 'Connected' },
    LogLevel: { Warning: 3 }
  };
});

const apiMocks = vi.hoisted(() => ({
  getChatStatus: vi.fn(),
  getChatConversations: vi.fn(),
  getChatConversation: vi.fn(),
  getChatSettings: vi.fn(),
  updateChatSettings: vi.fn()
}));
vi.mock('./chatApi', () => apiMocks);
vi.mock('./api', () => ({ getToken: () => 'token' }));

const soundMock = vi.hoisted(() => ({ playChatSound: vi.fn() }));
vi.mock('./chatSounds', () => soundMock);

function conversation(id: number, patch: Partial<ChatConversationDto> = {}): ChatConversationDto {
  return {
    id,
    kind: 0,
    title: `Диалог ${id}`,
    peerUserId: 2,
    myRole: 0,
    isMuted: false,
    isPinned: false,
    isArchived: false,
    unreadCount: 0,
    myLastReadMessageId: 0,
    createdAtUtc: '2026-11-01T00:00:00Z',
    lastMessageAtUtc: '2026-11-01T00:00:00Z',
    participants: [
      { userId: 1, displayName: 'Я', role: 0, isInactive: false, lastReadMessageId: 0 },
      { userId: 2, displayName: 'Борис', role: 0, isInactive: false, lastReadMessageId: 0 }
    ],
    ...patch
  };
}

function message(id: number, conversationId: number, patch: Partial<ChatMessageDto> = {}): ChatMessageDto {
  return {
    id,
    conversationId,
    kind: 0,
    senderUserId: 2,
    senderName: 'Борис',
    text: 'Привет',
    createdAtUtc: '2026-11-13T10:00:00Z',
    isDeleted: false,
    attachments: [],
    reactions: [],
    ...patch
  };
}

let latest: ReturnType<typeof useChat> | null = null;

function Probe({ active }: { active?: number }) {
  const chat = useChat();
  latest = chat;
  useEffect(() => {
    if (active) {
      chat.setActiveConversationId(active);
    }
  }, [active, chat.setActiveConversationId]);
  return null;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function flush() {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }
  });
}

async function mount(active?: number) {
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container!);
    root.render(<ChatProvider userId={1}><Probe active={active} /></ChatProvider>);
  });
  await flush();
}

function emit(name: string, payload: unknown) {
  act(() => hub.handlers.get(name)!(payload));
}

beforeEach(() => {
  hub.handlers.clear();
  hub.start.mockResolvedValue(undefined);
  hub.stop.mockResolvedValue(undefined);
  hub.invoke.mockResolvedValue([2]);
  apiMocks.getChatStatus.mockResolvedValue({ enabled: true, currentUserId: 1, maxAttachmentBytes: 1, maxAttachmentsPerMessage: 1, maxMessageLength: 1 });
  apiMocks.getChatConversations.mockResolvedValue([conversation(10), conversation(20, { isMuted: true })]);
  apiMocks.getChatSettings.mockResolvedValue({ notificationsEnabled: true, soundEnabled: true, soundName: 'bell', soundVolume: 40, showMessagePreview: true });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  latest = null;
  vi.clearAllMocks();
});

describe('ChatProvider', () => {
  it('loads conversations, settings and presence when chat is enabled', async () => {
    await mount();
    expect(latest!.enabled).toBe(true);
    expect(latest!.conversations.map((item) => item.id)).toEqual([10, 20]);
    expect(latest!.settings.soundName).toBe('bell');
    expect(latest!.onlineUserIds.has(2)).toBe(true);
  });

  it('does not connect when chat is disabled', async () => {
    apiMocks.getChatStatus.mockResolvedValue({ enabled: false, currentUserId: 1, maxAttachmentBytes: 0, maxAttachmentsPerMessage: 0, maxMessageLength: 0 });
    await mount();
    expect(latest!.enabled).toBe(false);
    expect(hub.start).not.toHaveBeenCalled();
    expect(apiMocks.getChatConversations).not.toHaveBeenCalled();
  });

  it('counts unread, plays sound and shows notification for a background conversation', async () => {
    await mount();
    emit('messageCreated', message(5, 10));
    await flush();

    expect(latest!.conversations.find((item) => item.id === 10)!.unreadCount).toBe(1);
    expect(latest!.totalUnread).toBe(1);
    expect(soundMock.playChatSound).toHaveBeenCalledWith('bell', 40);
    expect(latest!.notifications).toHaveLength(1);
    expect(latest!.notifications[0]).toMatchObject({ conversationId: 10, author: 'Борис', preview: 'Привет' });
  });

  it('stays silent for the open conversation and for muted ones', async () => {
    await mount(10);
    emit('messageCreated', message(5, 10));
    emit('messageCreated', message(6, 20));
    await flush();

    expect(soundMock.playChatSound).not.toHaveBeenCalled();
    expect(latest!.notifications).toHaveLength(0);
    expect(latest!.conversations.find((item) => item.id === 10)!.unreadCount).toBe(0);
    expect(latest!.conversations.find((item) => item.id === 20)!.unreadCount).toBe(1);
    expect(latest!.totalUnread).toBe(0);
  });

  it('respects disabled sound and hidden preview', async () => {
    apiMocks.getChatSettings.mockResolvedValue({ notificationsEnabled: true, soundEnabled: false, soundName: 'chime', soundVolume: 70, showMessagePreview: false });
    await mount();
    emit('messageCreated', message(5, 10));
    await flush();

    expect(soundMock.playChatSound).not.toHaveBeenCalled();
    expect(latest!.notifications[0].preview).toBe('Новое сообщение');
  });

  it('resets unread when the user reads the conversation in another tab', async () => {
    await mount();
    emit('messageCreated', message(5, 10));
    await flush();
    emit('readStateChanged', { conversationId: 10, userId: 1, lastReadMessageId: 5 });

    expect(latest!.conversations.find((item) => item.id === 10)!.unreadCount).toBe(0);
  });

  it('tracks typing and presence events', async () => {
    await mount();
    emit('typing', { conversationId: 10, userId: 2, displayName: 'Борис' });
    expect(latest!.typingByConversation[10]).toEqual([{ userId: 2, displayName: 'Борис' }]);

    emit('presenceChanged', { userId: 2, isOnline: false });
    expect(latest!.onlineUserIds.has(2)).toBe(false);
  });

  it('adds a conversation that is not in the list yet', async () => {
    apiMocks.getChatConversation.mockResolvedValue(conversation(30, { title: 'Новая группа', kind: 1, unreadCount: 1 }));
    await mount();
    emit('messageCreated', message(9, 30));
    await flush();

    const added = latest!.conversations.find((item) => item.id === 30);
    expect(added?.title).toBe('Новая группа');
    expect(added?.unreadCount).toBe(1);
  });
});
