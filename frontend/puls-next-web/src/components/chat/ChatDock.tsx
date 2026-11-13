import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useOptionalChat } from '../../app/ChatContext';
import { ConversationListItem, ConversationView } from '../../pages/ChatPage';
import { NewChatDialog } from './ChatDialogs';
import '../../chat.css';
import { ChatSearchResults, useChatMessageSearch } from './ChatSearch';

export const DOCK_DEFAULT_SIZE = { width: 390, height: 600 };
export const DOCK_MIN_SIZE = { width: 320, height: 380 };
const DOCK_MARGIN = 24;

/** Окно не меньше минимума и не больше экрана (с отступами). */
export function clampDockSize(size: { width: number; height: number }, viewport = { width: window.innerWidth, height: window.innerHeight }) {
  const maxWidth = Math.max(DOCK_MIN_SIZE.width, viewport.width - DOCK_MARGIN * 2);
  const maxHeight = Math.max(DOCK_MIN_SIZE.height, viewport.height - DOCK_MARGIN * 2);
  return {
    width: Math.round(Math.min(Math.max(size.width, DOCK_MIN_SIZE.width), maxWidth)),
    height: Math.round(Math.min(Math.max(size.height, DOCK_MIN_SIZE.height), maxHeight))
  };
}

type ResizeEdge = 'left' | 'top' | 'corner';

function ChatBubbleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="26" height="26">
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6A1 1 0 0 1 4 18.84Zm4 3.5v2h8V9Zm0-3v2h6V6Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Плавающее окно чата в правом нижнем углу: переписка без ухода со страницы.
 * На самой странице «Чат» не показывается — там полноценный интерфейс.
 */
export function ChatDock() {
  const chat = useOptionalChat();
  const location = useLocation();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('');
  const messageSearch = useChatMessageSearch(filter);
  const [jump, setJump] = useState<{ conversationId: number; messageId: number; requestKey: string } | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [dragSize, setDragSize] = useState<{ width: number; height: number } | null>(null);
  const [, setViewportTick] = useState(0);
  const dragRef = useRef<{ edge: ResizeEdge; x: number; y: number; width: number; height: number; last: { width: number; height: number } } | null>(null);

  useEffect(() => {
    // При изменении размера браузера окно чата ужимается, чтобы не выходить за экран.
    const onResize = () => setViewportTick((value) => value + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onChatPage = location.pathname === '/chat' || location.pathname.startsWith('/chat/');
  const visible = !!chat?.enabled && !onChatPage;
  const dock = chat?.dock;
  const conversation = dock?.conversationId ? chat?.conversations.find((item) => item.id === dock.conversationId) ?? null : null;
  const showThread = !!(visible && dock?.open && conversation);

  // Открытый в окне диалог считается «просматриваемым»: по нему не всплывают оповещения и он отмечается прочитанным.
  const setActive = chat?.setActiveConversationId;
  useEffect(() => {
    if (!setActive || !showThread || !conversation) {
      return;
    }

    setActive(conversation.id);
    return () => setActive(null);
  }, [conversation?.id, setActive, showThread]);

  const filtered = useMemo(() => {
    const items = chat?.conversations ?? [];
    const term = filter.trim().toLowerCase();
    return term ? items.filter((item) => item.title.toLowerCase().includes(term)) : items;
  }, [chat?.conversations, filter]);

  if (!chat || !visible || !dock) {
    return null;
  }

  if (!dock.open) {
    return (
      <button
        type="button"
        className="chat-dock-fab"
        onClick={() => chat.openDock()}
        aria-label={chat.totalUnread > 0 ? `Открыть чат, непрочитанных: ${chat.totalUnread}` : 'Открыть чат'}
        title="Чат"
      >
        <ChatBubbleIcon />
        {chat.totalUnread > 0 ? <span className="chat-dock-fab-badge">{chat.totalUnread > 99 ? '99+' : chat.totalUnread}</span> : null}
      </button>
    );
  }

  const savedSize = dock.width && dock.height ? { width: dock.width, height: dock.height } : DOCK_DEFAULT_SIZE;
  const size = clampDockSize(dragSize ?? savedSize);

  const startResize = (edge: ResizeEdge) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { edge, x: event.clientX, y: event.clientY, width: size.width, height: size.height, last: size };
    setDragSize(size);
  };

  const moveResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }

    // Окно прижато к правому нижнему углу: тянем влево — шире, вверх — выше.
    const next = clampDockSize({
      width: drag.edge === 'top' ? drag.width : drag.width + (drag.x - event.clientX),
      height: drag.edge === 'left' ? drag.height : drag.height + (drag.y - event.clientY)
    });
    // Последний размер держим в ref: к моменту pointerup состояние React может быть еще не обновлено.
    drag.last = next;
    setDragSize(next);
  };

  const endResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
    const finalSize = clampDockSize(drag.last);
    setDragSize(null);
    chat.resizeDock(finalSize.width === DOCK_DEFAULT_SIZE.width && finalSize.height === DOCK_DEFAULT_SIZE.height ? null : finalSize);
  };

  const resizeHandle = (edge: ResizeEdge, label: string) => (
    <div
      className={`chat-dock-resize chat-dock-resize-${edge}`}
      role="separator"
      aria-label={label}
      title="Потяните, чтобы изменить размер. Двойной клик — стандартный размер"
      onPointerDown={startResize(edge)}
      onPointerMove={moveResize}
      onPointerUp={endResize}
      onPointerCancel={endResize}
      onDoubleClick={() => {
        setDragSize(null);
        chat.resizeDock(null);
      }}
    />
  );

  const windowButtons = (
    <>
      <button
        type="button"
        className="chat-icon-button"
        onClick={() => {
          chat.minimizeDock();
          navigate(conversation ? `/chat/${conversation.id}` : '/chat');
        }}
        title="Открыть на всю страницу"
        aria-label="Открыть на всю страницу"
      >
        ⤢
      </button>
      <button type="button" className="chat-icon-button" onClick={chat.minimizeDock} title="Свернуть" aria-label="Свернуть чат">
        —
      </button>
    </>
  );

  return (
    <section
      className={`chat-dock${dragSize ? ' chat-dock-resizing' : ''}`}
      aria-label="Окно чата"
      style={{ width: size.width, height: size.height }}
    >
      {resizeHandle('left', 'Изменить ширину окна чата')}
      {resizeHandle('top', 'Изменить высоту окна чата')}
      {resizeHandle('corner', 'Изменить размер окна чата')}
      {conversation ? (
        <ConversationView
          key={conversation.id}
          conversation={conversation}
          compact
          onBack={() => chat.openDock(null)}
          headerExtra={windowButtons}
          jumpTo={jump && jump.conversationId === conversation.id ? jump : null}
        />
      ) : (
        <div className="chat-dock-list">
          <header className="chat-dock-head">
            <span className="chat-dock-title">
              Чаты
              {chat.totalUnread > 0 ? <span className="chat-unread-badge">{chat.totalUnread}</span> : null}
            </span>
            <button type="button" className="chat-icon-button chat-icon-button-primary" onClick={() => setNewChatOpen(true)} title="Новый чат" aria-label="Новый чат">
              ✎
            </button>
            {windowButtons}
          </header>
          <div className="chat-dock-search">
            <input
              className="chat-input"
              type="search"
              placeholder="Поиск по чатам и сообщениям"
              aria-label="Поиск по чатам и сообщениям"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>
          {chat.connectionState === 'reconnecting' || chat.connectionState === 'offline' ? (
            <div className="chat-connection-banner">{chat.connectionState === 'reconnecting' ? 'Переподключение…' : 'Нет связи с сервером чата'}</div>
          ) : null}
          <div className="chat-conversation-list">
            {!chat.conversationsLoaded ? <div className="chat-muted chat-list-hint">Загрузка…</div> : null}
            {chat.conversationsLoaded && filtered.length === 0 && !messageSearch.enabled ? (
              <div className="chat-list-empty">
                <div className="chat-muted">{chat.conversations.length === 0 ? 'Здесь появятся ваши диалоги.' : 'Ничего не найдено'}</div>
                {chat.conversations.length === 0 ? (
                  <button type="button" className="primary-button button-inline" onClick={() => setNewChatOpen(true)}>Начать чат</button>
                ) : null}
              </div>
            ) : null}
            {messageSearch.enabled && filtered.length > 0 ? <div className="chat-list-section">Чаты</div> : null}
            {filtered.map((item) => (
              <ConversationListItem key={item.id} conversation={item} active={false} onClick={() => chat.openDock(item.id)} />
            ))}
            {messageSearch.enabled ? (
              <>
                <div className="chat-list-section">Сообщения</div>
                <ChatSearchResults
                  search={messageSearch}
                  showConversation
                  onSelect={(result) => {
                    setJump({ conversationId: result.conversationId, messageId: result.message.id, requestKey: String(Date.now()) });
                    chat.openDock(result.conversationId);
                  }}
                />
              </>
            ) : null}
          </div>
        </div>
      )}

      <NewChatDialog
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onOpened={(created) => {
          setNewChatOpen(false);
          chat.openDock(created.id);
        }}
      />
    </section>
  );
}
