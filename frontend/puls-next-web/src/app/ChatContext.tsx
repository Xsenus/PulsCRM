import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr';
import { getToken } from './api';
import { getChatConversation, getChatConversations, getChatSettings, getChatStatus, updateChatSettings } from './chatApi';
import { describeLastMessage, sortConversations } from './chatFormat';
import { playChatSound } from './chatSounds';
import type {
  ChatConversationDto,
  ChatMessageDto,
  ChatPresenceEventDto,
  ChatReadStateEventDto,
  ChatStatusDto,
  ChatTypingEventDto,
  ChatUserSettingsDto
} from './chatTypes';
import { isSystemMessage } from './chatTypes';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '';
const TYPING_TTL_MS = 6000;
const POLL_INTERVAL_MS = 30000;
const DOCK_STATE_KEY = 'puls-chat-dock';

export interface ChatDockState {
  open: boolean;
  conversationId: number | null;
}

function readDockState(): ChatDockState {
  try {
    const parsed = JSON.parse(localStorage.getItem(DOCK_STATE_KEY) ?? 'null');
    if (parsed && typeof parsed.open === 'boolean') {
      return { open: parsed.open, conversationId: typeof parsed.conversationId === 'number' ? parsed.conversationId : null };
    }
  } catch {
    // Повреждённое или недоступное хранилище — начинаем со свернутого окна.
  }

  return { open: false, conversationId: null };
}

export const DEFAULT_CHAT_SETTINGS: ChatUserSettingsDto = {
  notificationsEnabled: true,
  soundEnabled: true,
  soundName: 'chime',
  soundVolume: 70,
  showMessagePreview: true
};

export type ChatEvent =
  | { type: 'messageCreated'; message: ChatMessageDto }
  | { type: 'messageUpdated'; message: ChatMessageDto }
  | { type: 'readStateChanged'; state: ChatReadStateEventDto }
  | { type: 'reconnected' };

export interface ChatNotification {
  id: number;
  conversationId: number;
  title: string;
  author: string;
  authorUserId: number;
  preview: string;
  icon?: string | null;
  isGroup: boolean;
}

export type ChatConnectionState = 'disabled' | 'connecting' | 'connected' | 'reconnecting' | 'offline';

interface ChatContextValue {
  status: ChatStatusDto | null;
  enabled: boolean;
  currentUserId: number;
  connectionState: ChatConnectionState;
  conversations: ChatConversationDto[];
  conversationsLoaded: boolean;
  totalUnread: number;
  settings: ChatUserSettingsDto;
  onlineUserIds: ReadonlySet<number>;
  typingByConversation: Record<number, Array<{ userId: number; displayName: string }>>;
  notifications: ChatNotification[];
  activeConversationId: number | null;
  setActiveConversationId: (id: number | null) => void;
  refreshConversations: () => Promise<void>;
  upsertConversation: (conversation: ChatConversationDto) => void;
  removeConversation: (conversationId: number) => void;
  markConversationReadLocally: (conversationId: number, messageId: number) => void;
  applyMessageLocally: (message: ChatMessageDto) => void;
  saveSettings: (settings: ChatUserSettingsDto) => Promise<void>;
  dismissNotification: (id: number) => void;
  sendTyping: (conversationId: number) => void;
  subscribe: (listener: (event: ChatEvent) => void) => () => void;
  /** Плавающее окно чата: открыто ли и какой диалог в нем. */
  dock: ChatDockState;
  openDock: (conversationId?: number | null) => void;
  minimizeDock: () => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

let nextNotificationId = 1;

export function ChatProvider({ userId, children }: { userId: number | null; children: ReactNode }) {
  const [status, setStatus] = useState<ChatStatusDto | null>(null);
  const [connectionState, setConnectionState] = useState<ChatConnectionState>('disabled');
  const [conversations, setConversations] = useState<ChatConversationDto[]>([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [settings, setSettings] = useState<ChatUserSettingsDto>(DEFAULT_CHAT_SETTINGS);
  const [onlineUserIds, setOnlineUserIds] = useState<ReadonlySet<number>>(new Set());
  const [typing, setTyping] = useState<Record<number, Record<number, { displayName: string; until: number }>>>({});
  const [notifications, setNotifications] = useState<ChatNotification[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [dock, setDock] = useState<ChatDockState>(readDockState);

  const connectionRef = useRef<HubConnection | null>(null);
  const listenersRef = useRef(new Set<(event: ChatEvent) => void>());
  const conversationsRef = useRef<ChatConversationDto[]>([]);
  const settingsRef = useRef(settings);
  const activeRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef<Record<number, number>>({});

  const enabled = !!status?.enabled;
  const currentUserId = status?.currentUserId ?? userId ?? 0;

  conversationsRef.current = conversations;
  settingsRef.current = settings;
  activeRef.current = activeConversationId;

  const emit = useCallback((event: ChatEvent) => {
    listenersRef.current.forEach((listener) => {
      try {
        listener(event);
      } catch {
        // Ошибка одного подписчика не должна мешать остальным.
      }
    });
  }, []);

  const upsertConversation = useCallback((conversation: ChatConversationDto) => {
    setConversations((current) => sortConversations([
      ...current.filter((item) => item.id !== conversation.id),
      conversation
    ]));
  }, []);

  const removeConversation = useCallback((conversationId: number) => {
    setConversations((current) => current.filter((item) => item.id !== conversationId));
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const items = await getChatConversations(false);
      setConversations(sortConversations(items));
      setConversationsLoaded(true);
    } catch {
      setConversationsLoaded(true);
    }
  }, []);

  const markConversationReadLocally = useCallback((conversationId: number, messageId: number) => {
    setConversations((current) => current.map((item) => item.id === conversationId
      ? {
          ...item,
          unreadCount: 0,
          myLastReadMessageId: Math.max(item.myLastReadMessageId, messageId),
          participants: item.participants.map((participant) => participant.userId === currentUserId
            ? { ...participant, lastReadMessageId: Math.max(participant.lastReadMessageId, messageId) }
            : participant)
        }
      : item));
  }, [currentUserId]);

  const applyMessageLocally = useCallback((message: ChatMessageDto) => {
    setConversations((current) => sortConversations(current.map((item) => {
      if (item.id !== message.conversationId) {
        return item;
      }

      const isNewer = !item.lastMessage || message.id >= item.lastMessage.id;
      return isNewer
        ? { ...item, lastMessage: message, lastMessageAtUtc: message.id === item.lastMessage?.id ? item.lastMessageAtUtc : message.createdAtUtc }
        : item;
    })));
  }, []);

  const notify = useCallback((message: ChatMessageDto, conversation: ChatConversationDto) => {
    const current = settingsRef.current;
    if (conversation.isMuted) {
      return;
    }

    if (current.soundEnabled) {
      void playChatSound(current.soundName, current.soundVolume);
    }

    if (!current.notificationsEnabled) {
      return;
    }

    const isGroup = conversation.kind === 'Group' || conversation.kind === 1;
    const preview = current.showMessagePreview
      ? describeLastMessage({ ...conversation, lastMessage: message }, currentUserId).replace(/^[^:]+: /, '')
      : 'Новое сообщение';
    const notification: ChatNotification = {
      id: nextNotificationId++,
      conversationId: conversation.id,
      title: conversation.title,
      author: message.senderName,
      authorUserId: message.senderUserId,
      preview,
      icon: conversation.icon,
      isGroup
    };

    setNotifications((items) => [...items.filter((item) => item.conversationId !== conversation.id), notification].slice(-4));
    window.setTimeout(() => {
      setNotifications((items) => items.filter((item) => item.id !== notification.id));
    }, 7000);
  }, [currentUserId]);

  const handleMessageCreated = useCallback(async (message: ChatMessageDto) => {
    emit({ type: 'messageCreated', message });
    const fromOther = message.senderUserId !== currentUserId && !isSystemMessage(message);
    const isVisibleHere = activeRef.current === message.conversationId && document.visibilityState === 'visible';

    let conversation = conversationsRef.current.find((item) => item.id === message.conversationId);
    if (!conversation) {
      try {
        conversation = await getChatConversation(message.conversationId);
      } catch {
        return;
      }
    }

    const updated: ChatConversationDto = {
      ...conversation,
      isArchived: false,
      lastMessage: message,
      lastMessageAtUtc: message.createdAtUtc,
      unreadCount: fromOther && !isVisibleHere ? conversation.unreadCount + (conversationsRef.current.some((item) => item.id === conversation!.id) ? 1 : 0) : conversation.unreadCount,
      myLastReadMessageId: message.senderUserId === currentUserId ? message.id : conversation.myLastReadMessageId
    };
    upsertConversation(updated);

    setTyping((current) => {
      const forConversation = current[message.conversationId];
      if (!forConversation?.[message.senderUserId]) {
        return current;
      }

      const { [message.senderUserId]: _, ...rest } = forConversation;
      return { ...current, [message.conversationId]: rest };
    });

    if (fromOther && !isVisibleHere) {
      notify(message, updated);
    }
  }, [currentUserId, emit, notify, upsertConversation]);

  useEffect(() => {
    setConversations([]);
    setConversationsLoaded(false);
    setStatus(null);
    if (!userId) {
      return;
    }

    let disposed = false;
    getChatStatus()
      .then((value) => {
        if (!disposed) {
          setStatus(value);
        }
      })
      .catch(() => {
        if (!disposed) {
          setStatus({ enabled: false, currentUserId: userId, maxAttachmentBytes: 0, maxAttachmentsPerMessage: 0, maxMessageLength: 0 });
        }
      });

    return () => {
      disposed = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!enabled) {
      setConnectionState('disabled');
      return;
    }

    let disposed = false;
    void refreshConversations();
    getChatSettings().then((value) => !disposed && setSettings(value)).catch(() => undefined);

    const connection = new HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/chat`, {
        accessTokenFactory: () => getToken() ?? '',
        withCredentials: false
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 20000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();
    connectionRef.current = connection;

    const loadPresence = async () => {
      const ids = Array.from(new Set(conversationsRef.current.flatMap((item) => item.participants.map((participant) => participant.userId))));
      if (ids.length === 0 || connection.state !== HubConnectionState.Connected) {
        return;
      }

      try {
        const online = await connection.invoke<number[]>('GetOnlineUsers', ids);
        if (!disposed) {
          setOnlineUserIds(new Set(online));
        }
      } catch {
        // Статус «в сети» не критичен.
      }
    };

    connection.on('messageCreated', (message: ChatMessageDto) => void handleMessageCreated(message));
    connection.on('messageUpdated', (message: ChatMessageDto) => {
      emit({ type: 'messageUpdated', message });
      setConversations((current) => current.map((item) => item.lastMessage?.id === message.id ? { ...item, lastMessage: message } : item));
    });
    connection.on('conversationUpdated', (conversation: ChatConversationDto) => upsertConversation(conversation));
    connection.on('conversationRemoved', (payload: { conversationId: number }) => removeConversation(payload.conversationId));
    connection.on('readStateChanged', (state: ChatReadStateEventDto) => {
      emit({ type: 'readStateChanged', state });
      setConversations((current) => current.map((item) => {
        if (item.id !== state.conversationId) {
          return item;
        }

        const participants = item.participants.map((participant) => participant.userId === state.userId
          ? { ...participant, lastReadMessageId: state.lastReadMessageId, lastReadAtUtc: state.lastReadAtUtc }
          : participant);
        return state.userId === currentUserId
          ? { ...item, participants, unreadCount: 0, myLastReadMessageId: state.lastReadMessageId }
          : { ...item, participants };
      }));
    });
    connection.on('typing', (event: ChatTypingEventDto) => {
      setTyping((current) => ({
        ...current,
        [event.conversationId]: {
          ...current[event.conversationId],
          [event.userId]: { displayName: event.displayName, until: Date.now() + TYPING_TTL_MS }
        }
      }));
    });
    connection.on('presenceChanged', (event: ChatPresenceEventDto) => {
      setOnlineUserIds((current) => {
        const next = new Set(current);
        if (event.isOnline) {
          next.add(event.userId);
        } else {
          next.delete(event.userId);
        }

        return next;
      });
    });

    connection.onreconnecting(() => !disposed && setConnectionState('reconnecting'));
    connection.onreconnected(async () => {
      if (disposed) {
        return;
      }

      setConnectionState('connected');
      await refreshConversations();
      emit({ type: 'reconnected' });
      void loadPresence();
    });
    connection.onclose(() => !disposed && setConnectionState('offline'));

    setConnectionState('connecting');
    connection.start()
      .then(() => {
        if (!disposed) {
          setConnectionState('connected');
          void loadPresence();
        }
      })
      .catch(() => !disposed && setConnectionState('offline'));

    // Страховка: если realtime недоступен, список диалогов обновляется периодически.
    const poll = window.setInterval(() => {
      if (connection.state !== HubConnectionState.Connected) {
        void refreshConversations();
      }
    }, POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(poll);
      connectionRef.current = null;
      void connection.stop();
    };
  }, [currentUserId, emit, enabled, handleMessageCreated, refreshConversations, removeConversation, upsertConversation]);

  useEffect(() => {
    if (!enabled || connectionState !== 'connected' || !conversationsLoaded) {
      return;
    }

    const connection = connectionRef.current;
    const ids = Array.from(new Set(conversations.flatMap((item) => item.participants.map((participant) => participant.userId))));
    if (!connection || ids.length === 0) {
      return;
    }

    connection.invoke<number[]>('GetOnlineUsers', ids)
      .then((online) => setOnlineUserIds(new Set(online)))
      .catch(() => undefined);
    // Состав участников меняется редко — перезапрашиваем статус при изменении числа диалогов.
  }, [enabled, connectionState, conversationsLoaded, conversations.length]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setTyping((current) => {
        let changed = false;
        const next: typeof current = {};
        Object.entries(current).forEach(([conversationId, users]) => {
          const alive = Object.fromEntries(Object.entries(users).filter(([, value]) => value.until > now));
          if (Object.keys(alive).length !== Object.keys(users).length) {
            changed = true;
          }

          if (Object.keys(alive).length > 0) {
            next[Number(conversationId)] = alive;
          }
        });
        return changed ? next : current;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const totalUnread = useMemo(
    () => conversations.filter((item) => !item.isMuted).reduce((sum, item) => sum + item.unreadCount, 0),
    [conversations]
  );

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s+/, '');
    document.title = totalUnread > 0 ? `(${totalUnread}) ${base}` : base;
  }, [totalUnread]);

  const typingByConversation = useMemo(() => {
    const result: Record<number, Array<{ userId: number; displayName: string }>> = {};
    Object.entries(typing).forEach(([conversationId, users]) => {
      result[Number(conversationId)] = Object.entries(users).map(([id, value]) => ({ userId: Number(id), displayName: value.displayName }));
    });
    return result;
  }, [typing]);

  const saveSettings = useCallback(async (next: ChatUserSettingsDto) => {
    const saved = await updateChatSettings(next);
    setSettings(saved);
  }, []);

  const dismissNotification = useCallback((id: number) => {
    setNotifications((items) => items.filter((item) => item.id !== id));
  }, []);

  const sendTyping = useCallback((conversationId: number) => {
    const connection = connectionRef.current;
    const now = Date.now();
    if (!connection || connection.state !== HubConnectionState.Connected || now - (lastTypingSentRef.current[conversationId] ?? 0) < 2500) {
      return;
    }

    lastTypingSentRef.current[conversationId] = now;
    connection.invoke('Typing', conversationId).catch(() => undefined);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DOCK_STATE_KEY, JSON.stringify(dock));
    } catch {
      // Запоминание окна — удобство, без него все работает.
    }
  }, [dock]);

  const openDock = useCallback((conversationId?: number | null) => {
    setDock((current) => ({ open: true, conversationId: conversationId === undefined ? current.conversationId : conversationId }));
  }, []);

  const minimizeDock = useCallback(() => {
    setDock((current) => ({ ...current, open: false }));
  }, []);

  const subscribe = useCallback((listener: (event: ChatEvent) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const value = useMemo<ChatContextValue>(() => ({
    status,
    enabled,
    currentUserId,
    connectionState,
    conversations,
    conversationsLoaded,
    totalUnread,
    settings,
    onlineUserIds,
    typingByConversation,
    notifications,
    activeConversationId,
    setActiveConversationId,
    refreshConversations,
    upsertConversation,
    removeConversation,
    markConversationReadLocally,
    applyMessageLocally,
    saveSettings,
    dismissNotification,
    sendTyping,
    subscribe,
    dock,
    openDock,
    minimizeDock
  }), [
    status, enabled, currentUserId, connectionState, conversations, conversationsLoaded, totalUnread, settings, onlineUserIds,
    typingByConversation, notifications, activeConversationId, refreshConversations, upsertConversation, removeConversation,
    markConversationReadLocally, applyMessageLocally, saveSettings, dismissNotification, sendTyping, subscribe,
    dock, openDock, minimizeDock
  ]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const value = useContext(ChatContext);
  if (!value) {
    throw new Error('useChat должен использоваться внутри ChatProvider.');
  }

  return value;
}

/** Для компонентов, которые могут рендериться и без провайдера (например, в тестах оболочки). */
export function useOptionalChat() {
  return useContext(ChatContext);
}
