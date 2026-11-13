import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useChat } from '../app/ChatContext';
import {
  deleteChatMessage,
  deletePendingChatAttachment,
  editChatMessage,
  getChatMessages,
  markChatRead,
  pinChatMessage,
  sendChatMessage,
  toggleChatReaction,
  updateChatPreferences,
  uploadChatAttachment
} from '../app/chatApi';
import {
  buildTimeline,
  createClientMessageId,
  describeLastMessage,
  describeMessageBody,
  formatChatTime,
  formatConversationTime,
  formatFileSize,
  getReadStatus,
  isEmojiOnly,
  mergeMessages,
  splitTextWithLinks
} from '../app/chatFormat';
import type { ChatAttachmentDto, ChatConversationDto, ChatMessageDto } from '../app/chatTypes';
import { isGroupConversation, isSystemMessage, roleRank } from '../app/chatTypes';
import { getApiErrorMessage } from '../app/apiErrors';
import { showToast } from '../app/toast';
import { ChatAvatar } from '../components/chat/ChatAvatar';
import { ChatAttachmentList } from '../components/chat/ChatAttachmentView';
import { ChatSettingsDialog, ConversationInfoDialog, ForwardMessageDialog, NewChatDialog } from '../components/chat/ChatDialogs';
import { EmojiPicker, QUICK_REACTIONS } from '../components/chat/EmojiPicker';
import { ChatLinkPreview, extractAppLinks, parseAppLink } from '../components/chat/ChatLinkPreview';
import { prepareChatImageUpload } from '../app/chatImageThumbnail';
import { ChatSearchResults, useChatMessageSearch } from '../components/chat/ChatSearch';
import { loadChatDraft, saveChatDraft, useChatDraft } from '../app/chatDrafts';
import '../chat.css';

const PAGE_SIZE = 50;
/** Переход к старому сообщению догружает историю крупными страницами, но не бесконечно. */
const JUMP_PAGE_SIZE = 200;
const MAX_JUMP_PAGES = 25;
const NEAR_BOTTOM_PX = 120;

export function ChatPage() {
  const { conversationId: routeId } = useParams();
  const navigate = useNavigate();
  const chat = useChat();
  const [filter, setFilter] = useState('');
  const messageSearch = useChatMessageSearch(filter);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const jumpMessageId = Number(searchParams.get('message')) || null;
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeId = routeId ? Number(routeId) : null;
  const active = chat.conversations.find((item) => item.id === activeId) ?? null;

  useEffect(() => {
    chat.setActiveConversationId(activeId);
    return () => chat.setActiveConversationId(null);
  }, [activeId, chat.setActiveConversationId]);

  useEffect(() => {
    if (activeId && chat.conversationsLoaded && !active) {
      // Диалог мог прийти позже (новый чат, архив) — один раз перечитываем список.
      void chat.refreshConversations();
    }
  }, [activeId, chat.conversationsLoaded]);

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) {
      return chat.conversations;
    }

    return chat.conversations.filter((item) => item.title.toLowerCase().includes(term)
      || item.participants.some((participant) => participant.displayName.toLowerCase().includes(term)));
  }, [chat.conversations, filter]);

  if (!chat.status) {
    return <div className="chat-page chat-page-loading">Загрузка чата…</div>;
  }

  if (!chat.enabled) {
    return (
      <div className="chat-page chat-page-disabled">
        <div className="chat-empty">
          <div className="chat-empty-icon">💬</div>
          <div className="chat-empty-title">Чат пока отключен</div>
          <div className="chat-muted">Администратору нужно подключить базу чата и включить его в настройках сервера.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`chat-page${active ? ' chat-page-has-active' : ''}`}>
      <aside className="chat-sidebar" aria-label="Диалоги">
        <div className="chat-sidebar-head">
          <input
            className="chat-input chat-search"
            type="search"
            placeholder="Поиск по чатам и сообщениям"
            aria-label="Поиск по чатам и сообщениям"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <button type="button" className="chat-icon-button" onClick={() => setSettingsOpen(true)} title="Оповещения и звук" aria-label="Оповещения и звук">
            🔔
          </button>
          <button type="button" className="chat-icon-button chat-icon-button-primary" onClick={() => setNewChatOpen(true)} title="Новый чат" aria-label="Новый чат">
            ✎
          </button>
        </div>

        {chat.connectionState === 'reconnecting' || chat.connectionState === 'offline' ? (
          <div className="chat-connection-banner">
            {chat.connectionState === 'reconnecting' ? 'Переподключение…' : 'Нет связи с сервером чата — сообщения обновляются реже'}
          </div>
        ) : null}

        <div className="chat-conversation-list">
          {!chat.conversationsLoaded ? <div className="chat-muted chat-list-hint">Загрузка…</div> : null}
          {chat.conversationsLoaded && chat.conversations.length === 0 ? (
            <div className="chat-list-empty">
              <div className="chat-muted">Здесь появятся ваши диалоги.</div>
              <button type="button" className="primary-button button-inline" onClick={() => setNewChatOpen(true)}>Начать чат</button>
            </div>
          ) : null}
          {chat.conversationsLoaded && chat.conversations.length > 0 && filtered.length === 0 && !messageSearch.enabled ? (
            <div className="chat-muted chat-list-hint">Ничего не найдено</div>
          ) : null}
          {messageSearch.enabled && filtered.length > 0 ? <div className="chat-list-section">Чаты</div> : null}
          {filtered.map((conversation) => (
            <ConversationListItem
              key={conversation.id}
              conversation={conversation}
              active={conversation.id === activeId}
              onClick={() => navigate(`/chat/${conversation.id}`)}
            />
          ))}
          {messageSearch.enabled ? (
            <>
              <div className="chat-list-section">Сообщения</div>
              <ChatSearchResults
                search={messageSearch}
                showConversation
                onSelect={(result) => navigate(`/chat/${result.conversationId}?message=${result.message.id}`)}
              />
            </>
          ) : null}
        </div>
      </aside>

      <section className="chat-main">
        {active ? (
          <ConversationView
            key={active.id}
            conversation={active}
            onBack={() => navigate('/chat')}
            jumpTo={jumpMessageId ? { messageId: jumpMessageId, requestKey: location.key } : null}
          />
        ) : (
          <div className="chat-empty">
            <div className="chat-empty-icon">💬</div>
            <div className="chat-empty-title">{activeId ? 'Диалог не найден' : 'Выберите диалог'}</div>
            <div className="chat-muted">или начните новый: личный с сотрудником или групповой.</div>
            <button type="button" className="primary-button button-inline" onClick={() => setNewChatOpen(true)}>Новый чат</button>
          </div>
        )}
      </section>

      <NewChatDialog
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onOpened={(conversation) => {
          setNewChatOpen(false);
          navigate(`/chat/${conversation.id}`);
        }}
      />
      <ChatSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export function ConversationListItem({ conversation, active, onClick }: { conversation: ChatConversationDto; active: boolean; onClick: () => void }) {
  const { currentUserId, onlineUserIds, typingByConversation } = useChat();
  const isGroup = isGroupConversation(conversation);
  const typing = typingByConversation[conversation.id] ?? [];
  const online = !isGroup && conversation.peerUserId ? onlineUserIds.has(conversation.peerUserId) : false;
  const draft = useChatDraft(currentUserId, conversation.id);
  const showDraft = !active && typing.length === 0 && draft.trim().length > 0;

  return (
    <button type="button" className={`chat-conversation-item${active ? ' active' : ''}`} onClick={onClick} aria-current={active ? 'true' : undefined}>
      <ChatAvatar name={conversation.title} seed={conversation.peerUserId ?? `g${conversation.id}`} icon={conversation.icon} online={online} group={isGroup} size={44} />
      <span className="chat-conversation-body">
        <span className="chat-conversation-top">
          <span className="chat-conversation-title">{conversation.title}</span>
          {conversation.isMuted ? <span className="chat-conversation-flag" title="Без звука">🔕</span> : null}
          {conversation.isPinned ? <span className="chat-conversation-flag" title="Закреплен">📌</span> : null}
          <span className="chat-conversation-time">{conversation.lastMessage ? formatConversationTime(conversation.lastMessageAtUtc) : ''}</span>
        </span>
        <span className="chat-conversation-bottom">
          <span className={`chat-conversation-preview${typing.length > 0 ? ' typing' : ''}`}>
            {typing.length > 0
              ? `${isGroup ? `${typing[0].displayName.split(' ')[0]} ` : ''}печатает…`
              : showDraft
                ? <><span className="chat-conversation-draft">Черновик:</span> {draft.replace(/\s+/g, ' ').trim()}</>
                : describeLastMessage(conversation, currentUserId)}
          </span>
          {conversation.unreadCount > 0 ? (
            <span className={`chat-unread-badge${conversation.isMuted ? ' muted' : ''}`}>{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

interface PendingUpload {
  key: string;
  file: File;
  progress: number;
  attachment?: ChatAttachmentDto;
  error?: string;
  previewUrl?: string;
}

export function ConversationView({ conversation, onBack, compact = false, headerExtra, jumpTo = null }: {
  conversation: ChatConversationDto;
  onBack: () => void;
  /** Открыть диалог на сообщении (из поиска); requestKey различает повторные переходы к одному сообщению. */
  jumpTo?: { messageId: number; requestKey: string } | null;
  /** Компактный режим для плавающего окна: всегда есть «назад», меньше кнопок в заголовке. */
  compact?: boolean;
  headerExtra?: React.ReactNode;
}) {
  const chat = useChat();
  const { currentUserId, status } = chat;
  const isGroup = isGroupConversation(conversation);
  const myRank = roleRank(conversation.myRole);

  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [hasMoreBefore, setHasMoreBefore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState(() => loadChatDraft(currentUserId, conversation.id));
  const [replyTo, setReplyTo] = useState<ChatMessageDto | null>(null);
  const [editing, setEditing] = useState<ChatMessageDto | null>(null);
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [newBelow, setNewBelow] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [forwarding, setForwarding] = useState<ChatMessageDto | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const conversationSearch = useChatMessageSearch(searchOpen ? searchQuery : '', conversation.id);
  const [firstUnreadId] = useState(() => (conversation.unreadCount > 0 ? conversation.myLastReadMessageId : null));

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nearBottomRef = useRef(true);
  const preserveScrollRef = useRef<{ height: number; top: number } | null>(null);
  const scrollToBottomRef = useRef<'instant' | 'smooth' | null>(null);
  const initialScrollDoneRef = useRef(false);
  const lastMarkedRef = useRef(0);
  /** Сообщение, к которому нужно прокрутить ленту после догрузки истории. */
  const pendingJumpRef = useRef<number | null>(null);
  /** Черновик, отложенный на время редактирования своего сообщения. */
  const stashedDraftRef = useRef('');
  const latestDraftRef = useRef({ text, editing: false });
  latestDraftRef.current = { text, editing: editing !== null };

  // Черновик сохраняется с небольшой задержкой и сразу — при уходе из диалога.
  useEffect(() => {
    if (editing) {
      return;
    }

    const timer = window.setTimeout(() => saveChatDraft(currentUserId, conversation.id, text), 400);
    return () => window.clearTimeout(timer);
  }, [conversation.id, currentUserId, editing, text]);

  useEffect(() => () => {
    const latest = latestDraftRef.current;
    saveChatDraft(currentUserId, conversation.id, latest.editing ? stashedDraftRef.current : latest.text);
  }, [conversation.id, currentUserId]);

  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : 0;
  const peer = !isGroup ? conversation.participants.find((item) => item.userId !== currentUserId) : undefined;
  const typing = (chat.typingByConversation[conversation.id] ?? []).filter((item) => item.userId !== currentUserId);
  const onlineCount = conversation.participants.filter((item) => chat.onlineUserIds.has(item.userId)).length;
  const peerInactive = !!peer?.isInactive;

  const subtitle = typing.length > 0
    ? (isGroup ? `${typing.map((item) => item.displayName.split(' ')[0]).join(', ')} печата${typing.length > 1 ? 'ют' : 'ет'}…` : 'печатает…')
    : isGroup
      ? `${conversation.participants.length} участник${pluralSuffix(conversation.participants.length)}${onlineCount > 0 ? `, ${onlineCount} в сети` : ''}`
      : peerInactive ? 'уволен' : peer && chat.onlineUserIds.has(peer.userId) ? 'в сети' : 'не в сети';

  const markRead = useCallback((upToId: number) => {
    if (upToId <= 0 || upToId <= lastMarkedRef.current || document.visibilityState !== 'visible') {
      return;
    }

    lastMarkedRef.current = upToId;
    chat.markConversationReadLocally(conversation.id, upToId);
    markChatRead(conversation.id, upToId).catch(() => {
      lastMarkedRef.current = 0;
    });
  }, [chat.markConversationReadLocally, conversation.id]);

  const loadLatest = useCallback(async () => {
    try {
      const page = await getChatMessages(conversation.id, undefined, PAGE_SIZE);
      setMessages((current) => mergeMessages(current, page.items));
      setHasMoreBefore((current) => current || page.hasMoreBefore);
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось загрузить сообщения.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [conversation.id]);

  useEffect(() => {
    lastMarkedRef.current = conversation.myLastReadMessageId;
    void loadLatest();
  }, [conversation.id]);

  useEffect(() => chat.subscribe((event) => {
    if (event.type === 'reconnected') {
      void loadLatest();
      return;
    }

    if (event.type !== 'messageCreated' && event.type !== 'messageUpdated') {
      return;
    }

    if (event.message.conversationId !== conversation.id) {
      return;
    }

    if (event.type === 'messageCreated') {
      if (nearBottomRef.current || event.message.senderUserId === currentUserId) {
        scrollToBottomRef.current = 'smooth';
      } else {
        setNewBelow((count) => count + 1);
      }
    }

    setMessages((current) => event.type === 'messageUpdated' && !current.some((item) => item.id === event.message.id)
      ? current
      : mergeMessages(current, [event.message]));
  }), [chat.subscribe, conversation.id, currentUserId, loadLatest]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    if (!initialScrollDoneRef.current) {
      if (messages.length === 0) {
        return;
      }

      // Первое открытие: к разделителю «Новые сообщения», иначе — в самый низ.
      initialScrollDoneRef.current = true;
      const divider = element.querySelector<HTMLElement>('.chat-unread-divider');
      element.scrollTop = divider ? Math.max(0, divider.offsetTop - 48) : element.scrollHeight;
      nearBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_PX;
      return;
    }

    if (pendingJumpRef.current) {
      const messageId = pendingJumpRef.current;
      pendingJumpRef.current = null;
      preserveScrollRef.current = null;
      if (!highlightMessage(messageId)) {
        showToast('Сообщение не найдено — возможно, оно удалено.', 'info');
      }

      return;
    }

    if (preserveScrollRef.current) {
      const { height, top } = preserveScrollRef.current;
      element.scrollTop = element.scrollHeight - height + top;
      preserveScrollRef.current = null;
      return;
    }

    if (scrollToBottomRef.current) {
      const behavior = scrollToBottomRef.current;
      scrollToBottomRef.current = null;
      if (behavior === 'smooth' && typeof element.scrollTo === 'function') {
        element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
      } else {
        element.scrollTop = element.scrollHeight;
      }

      nearBottomRef.current = true;
    }
  }, [messages]);

  useEffect(() => {
    if (nearBottomRef.current && lastMessageId > 0) {
      markRead(lastMessageId);
    }
  }, [lastMessageId, markRead]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && nearBottomRef.current) {
        markRead(lastMessageId);
      }
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [lastMessageId, markRead]);

  useEffect(() => () => {
    uploads.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    // Только при размонтировании.
  }, []);

  const loadOlder = async () => {
    if (loadingOlder || !hasMoreBefore || messages.length === 0) {
      return;
    }

    setLoadingOlder(true);
    try {
      const page = await getChatMessages(conversation.id, messages[0].id, PAGE_SIZE);
      const element = scrollRef.current;
      if (element) {
        preserveScrollRef.current = { height: element.scrollHeight, top: element.scrollTop };
      }

      setMessages((current) => mergeMessages(page.items, current));
      setHasMoreBefore(page.hasMoreBefore);
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось загрузить сообщения.'), 'error');
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_PX;
    nearBottomRef.current = nearBottom;
    if (nearBottom) {
      setNewBelow(0);
      markRead(lastMessageId);
    }

    if (element.scrollTop < 80) {
      void loadOlder();
    }
  };

  const scrollToBottom = () => {
    scrollToBottomRef.current = 'smooth';
    setNewBelow(0);
    setMessages((current) => [...current]);
  };

  /** Прокручивает к сообщению и подсвечивает его; false — сообщения нет в загруженной ленте. */
  function highlightMessage(messageId: number) {
    const target = scrollRef.current?.querySelector(`[data-message-id="${messageId}"]`);
    if (!target) {
      return false;
    }

    target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    target.classList.add('chat-message-highlight');
    window.setTimeout(() => target.classList.remove('chat-message-highlight'), 1600);
    return true;
  }

  /** Переход к сообщению (ответ, закреп): если оно выше загруженного, догружаем историю. */
  const scrollToMessage = async (messageId: number) => {
    if (highlightMessage(messageId) || messages.length === 0) {
      return;
    }

    if (!hasMoreBefore || messages[0].id < messageId) {
      showToast('Сообщение не найдено — возможно, оно удалено.', 'info');
      return;
    }

    setLoadingOlder(true);
    try {
      let oldest = messages[0].id;
      let more: boolean = hasMoreBefore;
      let loaded: ChatMessageDto[] = [];
      for (let attempt = 0; attempt < MAX_JUMP_PAGES && more && oldest > messageId; attempt += 1) {
        const page = await getChatMessages(conversation.id, oldest, JUMP_PAGE_SIZE);
        if (page.items.length === 0) {
          more = false;
          break;
        }

        loaded = [...page.items, ...loaded];
        more = page.hasMoreBefore;
        oldest = page.items[0].id;
      }

      pendingJumpRef.current = messageId;
      setMessages((current) => mergeMessages(loaded, current));
      setHasMoreBefore(more);
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось загрузить сообщения.'), 'error');
    } finally {
      setLoadingOlder(false);
    }
  };

  const scrollToMessageRef = useRef(scrollToMessage);
  scrollToMessageRef.current = scrollToMessage;

  const changePinnedMessage = async (messageId: number | null) => {
    try {
      chat.upsertConversation(await pinChatMessage(conversation.id, messageId));
    } catch (error) {
      showToast(getApiErrorMessage(error, messageId ? 'Не удалось закрепить сообщение.' : 'Не удалось открепить сообщение.'), 'error');
    }
  };

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) {
      return;
    }

    const limit = status?.maxAttachmentsPerMessage ?? 10;
    const maxBytes = status?.maxAttachmentBytes ?? 25 * 1024 * 1024;
    const room = Math.max(0, limit - uploads.length);
    if (list.length > room) {
      showToast(`К сообщению можно прикрепить не больше ${limit} файлов.`, 'warning');
    }

    list.slice(0, room).forEach((file) => {
      const key = createClientMessageId();
      if (file.size > maxBytes) {
        showToast(`«${file.name}» больше ${formatFileSize(maxBytes)}.`, 'error');
        return;
      }

      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      setUploads((current) => [...current, { key, file, progress: 0, previewUrl }]);
      prepareChatImageUpload(file)
        .then((extras) => uploadChatAttachment(conversation.id, file, (progress) => {
          setUploads((current) => current.map((item) => item.key === key ? { ...item, progress } : item));
        }, extras))
        .then((attachment) => setUploads((current) => current.map((item) => item.key === key ? { ...item, attachment, progress: 100 } : item)))
        .catch((error) => setUploads((current) => current.map((item) => item.key === key ? { ...item, error: getApiErrorMessage(error, 'Ошибка загрузки') } : item)));
    });
    textareaRef.current?.focus();
  };

  const removeUpload = (upload: PendingUpload) => {
    setUploads((current) => current.filter((item) => item.key !== upload.key));
    if (upload.previewUrl) {
      URL.revokeObjectURL(upload.previewUrl);
    }

    if (upload.attachment) {
      deletePendingChatAttachment(upload.attachment.id).catch(() => undefined);
    }
  };

  const finishEditing = () => {
    setText(stashedDraftRef.current);
    stashedDraftRef.current = '';
    setEditing(null);
  };

  const resetComposer = () => {
    if (editing) {
      finishEditing();
    } else {
      setText('');
      saveChatDraft(currentUserId, conversation.id, '');
    }

    setReplyTo(null);
    uploads.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    setUploads([]);
  };

  const uploading = uploads.some((item) => !item.attachment && !item.error);
  const readyAttachments = uploads.filter((item) => item.attachment).map((item) => item.attachment!.id);
  const canSend = !sending && !uploading && !peerInactive && (text.trim().length > 0 || (!editing && readyAttachments.length > 0));

  const submit = async () => {
    if (!canSend) {
      return;
    }

    const trimmed = text.trim();
    setSending(true);
    try {
      if (editing) {
        const updated = await editChatMessage(editing.id, trimmed);
        setMessages((current) => mergeMessages(current, [updated]));
        chat.applyMessageLocally(updated);
      } else {
        const message = await sendChatMessage(conversation.id, {
          text: trimmed || undefined,
          replyToMessageId: replyTo?.id,
          attachmentIds: readyAttachments,
          clientMessageId: createClientMessageId()
        });
        scrollToBottomRef.current = 'smooth';
        setMessages((current) => mergeMessages(current, [message]));
        chat.applyMessageLocally(message);
        lastMarkedRef.current = Math.max(lastMarkedRef.current, message.id);
      }

      resetComposer();
    } catch (error) {
      showToast(getApiErrorMessage(error, editing ? 'Не удалось изменить сообщение.' : 'Не удалось отправить сообщение.'), 'error');
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const startEdit = (message: ChatMessageDto) => {
    setReplyTo(null);
    if (!editing) {
      stashedDraftRef.current = text;
    }

    setEditing(message);
    setText(message.text ?? '');
    window.setTimeout(() => {
      const element = textareaRef.current;
      element?.focus();
      element?.setSelectionRange(element.value.length, element.value.length);
    }, 0);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
      return;
    }

    if (event.key === 'Escape' && (editing || replyTo)) {
      event.preventDefault();
      if (editing) {
        finishEditing();
      }

      setReplyTo(null);
      return;
    }

    if (event.key === 'ArrowUp' && !text && !editing) {
      const lastOwn = [...messages].reverse().find((item) => item.senderUserId === currentUserId && !item.isDeleted && !isSystemMessage(item));
      if (lastOwn) {
        event.preventDefault();
        startEdit(lastOwn);
      }
    }
  };

  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (element) {
      element.style.height = 'auto';
      element.style.height = `${Math.min(element.scrollHeight, 200)}px`;
    }
  }, [text]);

  const handleReaction = async (message: ChatMessageDto, emoji: string) => {
    try {
      const updated = await toggleChatReaction(message.id, emoji);
      setMessages((current) => mergeMessages(current, [updated]));
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось поставить реакцию.'), 'error');
    }
  };

  const handleDelete = async (message: ChatMessageDto) => {
    if (!window.confirm('Удалить сообщение у всех участников?')) {
      return;
    }

    try {
      const updated = await deleteChatMessage(message.id);
      setMessages((current) => mergeMessages(current, [updated]));
      chat.applyMessageLocally(updated);
      if (editing?.id === message.id) {
        resetComposer();
      }
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось удалить сообщение.'), 'error');
    }
  };

  const togglePreference = async (patch: { isMuted?: boolean; isPinned?: boolean; isArchived?: boolean }) => {
    try {
      const updated = await updateChatPreferences(conversation.id, patch);
      if (patch.isArchived) {
        chat.removeConversation(conversation.id);
        onBack();
        showToast('Диалог перенесен в архив. Он вернется, когда придет новое сообщение.', 'info', 4000);
      } else {
        chat.upsertConversation(updated);
      }
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось изменить настройки диалога.'), 'error');
    }
  };

  const handledJumpRef = useRef<string | null>(null);
  useEffect(() => {
    if (!jumpTo || loading || messages.length === 0) {
      return;
    }

    const key = `${jumpTo.messageId}:${jumpTo.requestKey}`;
    if (handledJumpRef.current === key) {
      return;
    }

    handledJumpRef.current = key;
    // Даем первой прокрутке (к низу ленты) отработать, затем переходим к сообщению.
    window.setTimeout(() => void scrollToMessageRef.current(jumpTo.messageId), 0);
  }, [jumpTo, loading, messages.length]);

  const timeline = useMemo(() => buildTimeline(messages), [messages]);

  return (
    <div
      className={`chat-view${compact ? ' chat-view-compact' : ''}${dragOver ? ' chat-view-drag' : ''}`}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) {
          setDragOver(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        if (!editing && event.dataTransfer.files.length > 0) {
          addFiles(event.dataTransfer.files);
        }
      }}
    >
      <header className="chat-view-head">
        <button type="button" className="chat-icon-button chat-back-button" onClick={onBack} aria-label="К списку диалогов">‹</button>
        <button type="button" className="chat-view-title" onClick={() => setInfoOpen(true)} title="О чате">
          <ChatAvatar
            name={conversation.title}
            seed={conversation.peerUserId ?? `g${conversation.id}`}
            icon={conversation.icon}
            group={isGroup}
            online={!!peer && chat.onlineUserIds.has(peer.userId)}
            size={compact ? 34 : 42}
          />
          <span className="chat-view-title-text">
            <span className="chat-view-name">{conversation.title}</span>
            <span className={`chat-view-subtitle${typing.length > 0 ? ' typing' : ''}`}>{subtitle}</span>
          </span>
        </button>
        <div className="chat-view-actions">
          {compact ? null : (
          <button
            type="button"
            className={`chat-icon-button${conversation.isPinned ? ' active' : ''}`}
            onClick={() => void togglePreference({ isPinned: !conversation.isPinned })}
            title={conversation.isPinned ? 'Открепить' : 'Закрепить'}
            aria-label={conversation.isPinned ? 'Открепить' : 'Закрепить'}
          >
            📌
          </button>
          )}
          <button
            type="button"
            className={`chat-icon-button${conversation.isMuted ? ' active' : ''}`}
            onClick={() => void togglePreference({ isMuted: !conversation.isMuted })}
            title={conversation.isMuted ? 'Включить звук' : 'Без звука'}
            aria-label={conversation.isMuted ? 'Включить звук' : 'Без звука'}
          >
            {conversation.isMuted ? '🔕' : '🔔'}
          </button>
          {compact ? null : (
            <button type="button" className="chat-icon-button" onClick={() => void togglePreference({ isArchived: true })} title="В архив" aria-label="В архив">
              🗄
            </button>
          )}
          <button
            type="button"
            className={`chat-icon-button${searchOpen ? ' active' : ''}`}
            onClick={() => setSearchOpen((value) => !value)}
            title="Поиск в диалоге"
            aria-label="Поиск в диалоге"
            aria-pressed={searchOpen}
          >
            🔍
          </button>
          <button type="button" className="chat-icon-button" onClick={() => setInfoOpen(true)} title="О чате" aria-label="О чате">
            ⓘ
          </button>
          {headerExtra}
        </div>
      </header>

      {searchOpen ? (
        <div className="chat-conversation-search">
          <div className="chat-conversation-search-row">
            <input
              className="chat-input"
              type="search"
              autoFocus
              placeholder="Найти в этом диалоге"
              aria-label="Найти в этом диалоге"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setSearchOpen(false);
                  setSearchQuery('');
                }
              }}
            />
            <button type="button" className="chat-icon-button" onClick={() => { setSearchOpen(false); setSearchQuery(''); }} aria-label="Закрыть поиск">
              ×
            </button>
          </div>
          <ChatSearchResults
            search={conversationSearch}
            showConversation={false}
            onSelect={(result) => void scrollToMessage(result.message.id)}
          />
        </div>
      ) : null}

      {conversation.pinnedMessage ? (
        <div className="chat-pinned-bar">
          <button
            type="button"
            className="chat-pinned-body"
            onClick={() => void scrollToMessage(conversation.pinnedMessage!.id)}
            title="Перейти к закрепленному сообщению"
          >
            <span className="chat-pinned-icon" aria-hidden="true">📌</span>
            <span className="chat-pinned-text">
              <strong>Закрепленное сообщение</strong>
              <span>{isGroup ? `${conversation.pinnedMessage.senderName.split(' ')[0]}: ` : ''}{describeMessageBody(conversation.pinnedMessage)}</span>
            </span>
          </button>
          {conversation.canPinMessages ? (
            <button type="button" className="chat-icon-button" onClick={() => void changePinnedMessage(null)} title="Открепить сообщение" aria-label="Открепить сообщение">
              ×
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        className="chat-messages"
        ref={scrollRef}
        onScroll={handleScroll}
        onLoadCapture={() => {
          // Картинки догружаются позже и сдвигают ленту — если пользователь был внизу, остаемся внизу.
          const element = scrollRef.current;
          if (element && nearBottomRef.current) {
            element.scrollTop = element.scrollHeight;
          }
        }}
        aria-live="polite"
      >
        {loadingOlder ? <div className="chat-muted chat-load-older">Загрузка…</div> : null}
        {!loading && !hasMoreBefore && messages.length > 0 ? <div className="chat-muted chat-load-older">Начало переписки</div> : null}
        {loading ? <div className="chat-muted chat-load-older">Загрузка сообщений…</div> : null}
        {!loading && messages.length === 0 ? (
          <div className="chat-empty chat-empty-inline">
            <div className="chat-empty-icon">👋</div>
            <div className="chat-muted">Сообщений пока нет. Напишите первым!</div>
          </div>
        ) : null}

        {timeline.map((item) => {
          if (item.type === 'day') {
            return <div key={item.key} className="chat-day-separator"><span>{item.label}</span></div>;
          }

          const { message } = item;
          const showUnreadDivider = firstUnreadId !== null && message.id > firstUnreadId
            && !messages.some((other) => other.id > firstUnreadId && other.id < message.id && other.senderUserId !== currentUserId)
            && message.senderUserId !== currentUserId;

          return (
            <React.Fragment key={item.key}>
              {showUnreadDivider ? <div className="chat-unread-divider"><span>Новые сообщения</span></div> : null}
              {isSystemMessage(message) ? (
                <div className="chat-system-message" data-message-id={message.id}>{message.text}</div>
              ) : (
                <MessageBubble
                  message={message}
                  own={message.senderUserId === currentUserId}
                  showAuthor={item.showAuthor && isGroup && message.senderUserId !== currentUserId}
                  isGroupEnd={item.isGroupEnd}
                  canModerate={isGroup && myRank >= 1}
                  readStatus={message.senderUserId === currentUserId ? getReadStatus(message, conversation.participants, currentUserId) : null}
                  onReply={() => { setEditing(null); setReplyTo(message); textareaRef.current?.focus(); }}
                  onEdit={() => startEdit(message)}
                  onDelete={() => void handleDelete(message)}
                  onReact={(emoji) => void handleReaction(message, emoji)}
                  onReplyClick={(id) => void scrollToMessage(id)}
                  pinState={conversation.canPinMessages && !isSystemMessage(message) && !message.isDeleted
                    ? (conversation.pinnedMessage?.id === message.id ? 'pinned' : 'unpinned')
                    : null}
                  onTogglePin={() => void changePinnedMessage(conversation.pinnedMessage?.id === message.id ? null : message.id)}
                  onForward={() => setForwarding(message)}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {newBelow > 0 ? (
        <button type="button" className="chat-jump-bottom" onClick={scrollToBottom} aria-label="К новым сообщениям">
          ↓ <span className="chat-unread-badge">{newBelow}</span>
        </button>
      ) : null}

      <footer className="chat-composer">
        {replyTo || editing ? (
          <div className="chat-composer-context">
            <span className="chat-composer-context-bar" />
            <span className="chat-composer-context-text">
              <strong>{editing ? 'Редактирование' : `Ответ ${replyTo!.senderName}`}</strong>
              <span>{(editing ?? replyTo)!.text || ((editing ?? replyTo)!.attachments.length > 0 ? '📎 Вложение' : '')}</span>
            </span>
            <button
              type="button"
              className="chat-icon-button"
              onClick={() => {
                if (editing) {
                  finishEditing();
                }

                setReplyTo(null);
              }}
              aria-label="Отменить"
            >
              ×
            </button>
          </div>
        ) : null}

        {uploads.length > 0 ? (
          <div className="chat-upload-list">
            {uploads.map((upload) => (
              <div key={upload.key} className={`chat-upload${upload.error ? ' failed' : ''}`} title={upload.error ?? upload.file.name}>
                {upload.previewUrl ? <img src={upload.previewUrl} alt="" /> : <span className="chat-upload-icon">📎</span>}
                <span className="chat-upload-meta">
                  <span className="chat-upload-name">{upload.file.name}</span>
                  <span className="chat-upload-size">
                    {upload.error ? upload.error : upload.attachment ? formatFileSize(upload.file.size) : `${upload.progress}%`}
                  </span>
                </span>
                {!upload.attachment && !upload.error ? <span className="chat-upload-progress" style={{ width: `${upload.progress}%` }} /> : null}
                <button type="button" className="chat-upload-remove" onClick={() => removeUpload(upload)} aria-label={`Убрать ${upload.file.name}`}>×</button>
              </div>
            ))}
          </div>
        ) : null}

        {peerInactive ? (
          <div className="chat-muted chat-composer-disabled">Сотрудник уволен — отправить сообщение нельзя.</div>
        ) : (
          <div className="chat-composer-row">
            <button
              type="button"
              className="chat-icon-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!!editing}
              title="Прикрепить файлы"
              aria-label="Прикрепить файлы"
            >
              📎
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(event) => {
                if (event.target.files) {
                  addFiles(event.target.files);
                }

                event.target.value = '';
              }}
            />
            <textarea
              ref={textareaRef}
              className="chat-textarea"
              rows={1}
              placeholder={editing ? 'Измените сообщение…' : 'Сообщение…'}
              value={text}
              maxLength={status?.maxMessageLength || undefined}
              onChange={(event) => {
                setText(event.target.value);
                if (event.target.value) {
                  chat.sendTyping(conversation.id);
                }
              }}
              onKeyDown={handleKeyDown}
              onPaste={(event) => {
                const files = Array.from(event.clipboardData.files);
                if (files.length > 0 && !editing) {
                  event.preventDefault();
                  addFiles(files);
                }
              }}
              aria-label="Текст сообщения"
            />
            <div className="chat-emoji-anchor">
              <button type="button" className="chat-icon-button" onClick={() => setEmojiOpen((value) => !value)} title="Эмодзи" aria-label="Эмодзи">
                😊
              </button>
              {emojiOpen ? (
                <EmojiPicker
                  className="chat-emoji-picker-composer"
                  onClose={() => setEmojiOpen(false)}
                  onSelect={(emoji) => {
                    const element = textareaRef.current;
                    const start = element?.selectionStart ?? text.length;
                    const end = element?.selectionEnd ?? text.length;
                    const next = `${text.slice(0, start)}${emoji}${text.slice(end)}`;
                    setText(next);
                    window.setTimeout(() => {
                      element?.focus();
                      element?.setSelectionRange(start + emoji.length, start + emoji.length);
                    }, 0);
                  }}
                />
              ) : null}
            </div>
            <button
              type="button"
              className="chat-send-button"
              onClick={() => void submit()}
              disabled={!canSend}
              title={editing ? 'Сохранить (Enter)' : 'Отправить (Enter)'}
              aria-label={editing ? 'Сохранить' : 'Отправить'}
            >
              {editing ? '✓' : '➤'}
            </button>
          </div>
        )}
      </footer>

      {dragOver ? <div className="chat-drop-overlay">Отпустите, чтобы прикрепить файлы</div> : null}

      <ConversationInfoDialog open={infoOpen} conversation={conversation} onClose={() => setInfoOpen(false)} onLeft={onBack} />
      <ForwardMessageDialog message={forwarding} onClose={() => setForwarding(null)} />
    </div>
  );
}

function pluralSuffix(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return '';
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return 'а';
  }

  return 'ов';
}

function MessageBubble({
  message,
  own,
  showAuthor,
  isGroupEnd,
  canModerate,
  readStatus,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onReplyClick,
  pinState = null,
  onTogglePin,
  onForward
}: {
  message: ChatMessageDto;
  own: boolean;
  showAuthor: boolean;
  isGroupEnd: boolean;
  canModerate: boolean;
  readStatus: 'sent' | 'read' | null;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
  onReplyClick: (messageId: number) => void;
  /** null — закреплять нельзя. */
  pinState?: 'pinned' | 'unpinned' | null;
  onTogglePin?: () => void;
  onForward?: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const bigEmoji = !message.isDeleted && message.attachments.length === 0 && !message.replyTo && isEmojiOnly(message.text);
  const textParts = useMemo(() => (message.text ? splitTextWithLinks(message.text) : []), [message.text]);
  const appLinks = useMemo(
    () => extractAppLinks(textParts.filter((part) => part.type === 'link').map((part) => (part as { href: string }).href)),
    [textParts]
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.text ?? '');
      showToast('Текст скопирован.', 'success', 1500);
    } catch {
      showToast('Не удалось скопировать текст.', 'error');
    }
  };

  return (
    <div
      className={`chat-message${own ? ' own' : ''}${isGroupEnd ? ' group-end' : ''}${showAuthor ? ' with-author' : ''}`}
      data-message-id={message.id}
      onMouseLeave={() => { setPickerOpen(false); setMoreOpen(false); }}
    >
      <div className={`chat-bubble${message.isDeleted ? ' deleted' : ''}${bigEmoji ? ' emoji-only' : ''}`}>
        {showAuthor ? <div className="chat-bubble-author">{message.senderName}</div> : null}

        {message.forwardedFrom && !message.isDeleted ? (
          <div className="chat-bubble-forwarded">↪ Переслано от <strong>{message.forwardedFrom.name}</strong></div>
        ) : null}

        {message.replyTo ? (
          <button type="button" className="chat-bubble-reply" onClick={() => onReplyClick(message.replyTo!.id)}>
            <span className="chat-bubble-reply-author">{message.replyTo.senderName}</span>
            <span className="chat-bubble-reply-text">
              {message.replyTo.isDeleted
                ? 'Сообщение удалено'
                : message.replyTo.text || (message.replyTo.attachmentCount > 0 ? `📎 Вложений: ${message.replyTo.attachmentCount}` : '')}
            </span>
          </button>
        ) : null}

        {message.isDeleted ? (
          <div className="chat-bubble-text chat-muted">🚫 Сообщение удалено</div>
        ) : (
          <>
            {message.attachments.length > 0 ? <ChatAttachmentList attachments={message.attachments} /> : null}
            {message.text ? (
              <div className="chat-bubble-text">
                {textParts.map((part, index) => {
                  if (part.type !== 'link') {
                    return <React.Fragment key={index}>{part.value}</React.Fragment>;
                  }

                  // Ссылки на объекты этой CRM открываются внутри приложения, остальные — в новой вкладке.
                  const appLink = parseAppLink(part.href);
                  return appLink ? (
                    <a
                      key={index}
                      href={part.href}
                      onClick={(event) => {
                        if (!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) {
                          event.preventDefault();
                          navigate(appLink.path);
                        }
                      }}
                    >
                      {part.value}
                    </a>
                  ) : (
                    <a key={index} href={part.href} target="_blank" rel="noopener noreferrer">{part.value}</a>
                  );
                })}
              </div>
            ) : null}
            {appLinks.length > 0 ? (
              <div className="chat-link-previews">
                {appLinks.map((link) => <ChatLinkPreview key={link.path} link={link} />)}
              </div>
            ) : null}
          </>
        )}

        <div className="chat-bubble-meta">
          {message.editedAtUtc && !message.isDeleted ? <span title={`Изменено ${formatChatTime(message.editedAtUtc)}`}>изменено</span> : null}
          <span>{formatChatTime(message.createdAtUtc)}</span>
          {readStatus ? <span className={`chat-ticks ${readStatus}`} title={readStatus === 'read' ? 'Прочитано' : 'Отправлено'}>{readStatus === 'read' ? '✓✓' : '✓'}</span> : null}
        </div>
      </div>

      {message.reactions.length > 0 ? (
        <div className="chat-reactions">
          {message.reactions.map((reaction) => (
            <button
              key={reaction.emoji}
              type="button"
              className={`chat-reaction${reaction.reactedByMe ? ' mine' : ''}`}
              onClick={() => onReact(reaction.emoji)}
              title={reaction.reactedByMe ? 'Убрать реакцию' : 'Поставить такую же'}
            >
              <span>{reaction.emoji}</span>
              <span>{reaction.count}</span>
            </button>
          ))}
        </div>
      ) : null}

      {!message.isDeleted ? (
        <div className="chat-message-actions" role="toolbar" aria-label="Действия с сообщением">
          <button type="button" onClick={() => setPickerOpen((value) => !value)} title="Реакция" aria-label="Реакция">🙂</button>
          <button type="button" onClick={onReply} title="Ответить" aria-label="Ответить">↩</button>
          <button type="button" onClick={() => setMoreOpen((value) => !value)} title="Еще" aria-label="Еще">⋯</button>
          {pickerOpen ? (
            <div className="chat-quick-reactions">
              {QUICK_REACTIONS.map((emoji) => (
                <button key={emoji} type="button" onClick={() => { setPickerOpen(false); onReact(emoji); }} aria-label={`Реакция ${emoji}`}>{emoji}</button>
              ))}
            </div>
          ) : null}
          {moreOpen ? (
            <div className="chat-message-menu" role="menu">
              {message.text ? <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); void copy(); }}>Копировать текст</button> : null}
              {own ? <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); onEdit(); }}>Изменить</button> : null}
              {!message.isDeleted && onForward ? (
                <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); onForward(); }}>Переслать</button>
              ) : null}
              {pinState ? (
                <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); onTogglePin?.(); }}>
                  {pinState === 'pinned' ? 'Открепить' : 'Закрепить'}
                </button>
              ) : null}
              {own || canModerate ? (
                <button type="button" role="menuitem" className="chat-danger-text" onClick={() => { setMoreOpen(false); onDelete(); }}>Удалить</button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
