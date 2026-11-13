import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useOptionalChat } from '../../app/ChatContext';
import { ConversationListItem, ConversationView } from '../../pages/ChatPage';
import { NewChatDialog } from './ChatDialogs';
import '../../chat.css';

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
  const [newChatOpen, setNewChatOpen] = useState(false);

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
    <section className="chat-dock" aria-label="Окно чата">
      {conversation ? (
        <ConversationView
          key={conversation.id}
          conversation={conversation}
          compact
          onBack={() => chat.openDock(null)}
          headerExtra={windowButtons}
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
            <input className="chat-input" type="search" placeholder="Поиск по чатам" value={filter} onChange={(event) => setFilter(event.target.value)} />
          </div>
          {chat.connectionState === 'reconnecting' || chat.connectionState === 'offline' ? (
            <div className="chat-connection-banner">{chat.connectionState === 'reconnecting' ? 'Переподключение…' : 'Нет связи с сервером чата'}</div>
          ) : null}
          <div className="chat-conversation-list">
            {!chat.conversationsLoaded ? <div className="chat-muted chat-list-hint">Загрузка…</div> : null}
            {chat.conversationsLoaded && filtered.length === 0 ? (
              <div className="chat-list-empty">
                <div className="chat-muted">{chat.conversations.length === 0 ? 'Здесь появятся ваши диалоги.' : 'Ничего не найдено'}</div>
                {chat.conversations.length === 0 ? (
                  <button type="button" className="primary-button button-inline" onClick={() => setNewChatOpen(true)}>Начать чат</button>
                ) : null}
              </div>
            ) : null}
            {filtered.map((item) => (
              <ConversationListItem key={item.id} conversation={item} active={false} onClick={() => chat.openDock(item.id)} />
            ))}
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
