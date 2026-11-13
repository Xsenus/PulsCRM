import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useOptionalChat } from '../../app/ChatContext';
import { ChatAvatar } from './ChatAvatar';
import '../../chat.css';

/** Всплывающие оповещения о новых сообщениях; клик открывает диалог. */
export function ChatNotifications() {
  const chat = useOptionalChat();
  const navigate = useNavigate();
  const location = useLocation();

  if (!chat || chat.notifications.length === 0) {
    return null;
  }

  return (
    <div
      className={`chat-notifications${onChatPage(location.pathname) ? '' : chat.dock.open ? ' beside-dock' : ' above-dock'}`}
      style={!onChatPage(location.pathname) && chat.dock.open && chat.dock.width ? { right: Math.min(chat.dock.width, window.innerWidth - 48) + 40 } : undefined}
      aria-live="polite"
    >
      {chat.notifications.map((notification) => (
        <div key={notification.id} className="chat-notification" role="status">
          <button
            type="button"
            className="chat-notification-body"
            onClick={() => {
              chat.dismissNotification(notification.id);
              if (onChatPage(location.pathname)) {
                navigate(`/chat/${notification.conversationId}`);
              } else {
                // Не уводим со страницы — открываем диалог в плавающем окне.
                chat.openDock(notification.conversationId);
              }
            }}
          >
            <ChatAvatar
              name={notification.isGroup ? notification.title : notification.author}
              seed={notification.isGroup ? `g${notification.conversationId}` : notification.authorUserId}
              icon={notification.icon}
              group={notification.isGroup}
              size={40}
            />
            <span className="chat-notification-text">
              <span className="chat-notification-title">{notification.isGroup ? notification.title : notification.author}</span>
              <span className="chat-notification-preview">
                {notification.isGroup ? <strong>{notification.author.split(' ')[0]}: </strong> : null}
                {notification.preview}
              </span>
            </span>
          </button>
          <button type="button" className="chat-notification-close" onClick={() => chat.dismissNotification(notification.id)} aria-label="Закрыть оповещение">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function onChatPage(pathname: string) {
  return pathname === '/chat' || pathname.startsWith('/chat/');
}
