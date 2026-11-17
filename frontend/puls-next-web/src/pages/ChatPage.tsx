import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useChat } from '../app/ChatContext';
import { NewChatDialog } from '../components/chat/ChatDialogs';
import { ChatSettingsDialog } from '../components/chat/ChatSettingsDialog';
import { ChatSearchResults, useChatMessageSearch } from '../components/chat/ChatSearch';
import '../chat.css';
import { ConversationListItem } from '../components/chat/ConversationListItem';
import { ConversationView } from '../components/chat/ConversationView';

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
  const activeFound = !!active;
  const { setActiveConversationId, conversationsLoaded, refreshConversations } = chat;

  useEffect(() => {
    setActiveConversationId(activeId);
    return () => setActiveConversationId(null);
  }, [activeId, setActiveConversationId]);

  useEffect(() => {
    if (activeId && conversationsLoaded && !activeFound) {
      // Диалог мог прийти позже (новый чат, архив) — один раз перечитываем список.
      void refreshConversations();
    }
  }, [activeFound, activeId, conversationsLoaded, refreshConversations]);

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
              onRemoved={conversation.id === activeId ? () => navigate('/chat') : undefined}
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
