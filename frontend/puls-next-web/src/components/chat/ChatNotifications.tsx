import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useOptionalChat } from '../../app/ChatContext';
import { ChatAvatar } from './ChatAvatar';
import '../../chat.css';

/** Всплывающие оповещения о новых сообщениях; клик открывает диалог. */
export function ChatNotifications() {
  const chat = useOptionalChat();
  const navigate = useNavigate();

  if (!chat || chat.notifications.length === 0) {
    return null;
  }

  return (
    <div className="chat-notifications" aria-live="polite">
      {chat.notifications.map((notification) => (
        <div key={notification.id} className="chat-notification" role="status">
          <button
            type="button"
            className="chat-notification-body"
            onClick={() => {
              chat.dismissNotification(notification.id);
              navigate(`/chat/${notification.conversationId}`);
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
