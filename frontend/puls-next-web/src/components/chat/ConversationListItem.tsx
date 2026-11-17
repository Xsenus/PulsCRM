import React, { useCallback, useState } from 'react';
import { useChat } from '../../app/ChatContext';
import { describeLastMessage, formatConversationTime, getReadStatus } from '../../app/chatFormat';
import type { ChatConversationDto } from '../../app/chatTypes';
import { isGroupConversation, isSystemMessage } from '../../app/chatTypes';
import { ChatAvatar } from './ChatAvatar';
import { ConversationInfoDialog } from './ChatDialogs';
import { ChatTicks } from './ChatTicks';
import { ChatConversationMenu } from './ChatConversationMenu';
import { useChatDraft } from '../../app/chatDrafts';
import '../../chat.css';

export function ConversationListItem({ conversation, active, onClick, onRemoved }: {
  conversation: ChatConversationDto;
  active: boolean;
  onClick: () => void;
  /** Диалог убран из списка из контекстного меню (архив, выход из группы). */
  onRemoved?: () => void;
}) {
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuAt(null), []);
  const { currentUserId, onlineUserIds, typingByConversation } = useChat();
  const isGroup = isGroupConversation(conversation);
  const typing = typingByConversation[conversation.id] ?? [];
  const online = !isGroup && conversation.peerUserId ? onlineUserIds.has(conversation.peerUserId) : false;
  const draft = useChatDraft(currentUserId, conversation.id);
  const showDraft = !active && typing.length === 0 && draft.trim().length > 0;

  return (
    <>
    <button
      type="button"
      className={`chat-conversation-item${active ? ' active' : ''}${menuAt ? ' menu-open' : ''}`}
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      aria-haspopup="menu"
      onContextMenu={(event) => {
        event.preventDefault();
        // С клавиатуры (клавиша меню, Shift+F10) координат нет — открываем у самого диалога.
        if (event.clientX === 0 && event.clientY === 0) {
          const rect = event.currentTarget.getBoundingClientRect();
          setMenuAt({ x: rect.left + 24, y: rect.bottom - 8 });
        } else {
          setMenuAt({ x: event.clientX, y: event.clientY });
        }
      }}
    >
      <ChatAvatar name={conversation.title} seed={conversation.peerUserId ?? `g${conversation.id}`} icon={conversation.icon} online={online} group={isGroup} size={44} />
      <span className="chat-conversation-body">
        <span className="chat-conversation-top">
          <span className="chat-conversation-title">{conversation.title}</span>
          {conversation.lastMessage && !conversation.lastMessage.isDeleted && conversation.lastMessage.senderUserId === currentUserId && !isSystemMessage(conversation.lastMessage) ? (
            <ChatTicks status={getReadStatus(conversation.lastMessage, conversation.participants, currentUserId)} className="in-list" />
          ) : null}
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
          {(conversation.unreadMentionCount ?? 0) > 0 ? (
            <span className="chat-mention-badge" title="Вас упомянули" aria-label="Вас упомянули">@</span>
          ) : null}
          {conversation.unreadCount > 0 ? (
            <span className={`chat-unread-badge${conversation.isMuted ? ' muted' : ''}`}>{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</span>
          ) : null}
        </span>
      </span>
    </button>
    {menuAt ? (
      <ChatConversationMenu
        conversation={conversation}
        position={menuAt}
        onClose={closeMenu}
        onOpenInfo={() => setInfoOpen(true)}
        onRemoved={onRemoved}
      />
    ) : null}
    {infoOpen ? (
      <ConversationInfoDialog open conversation={conversation} onClose={() => setInfoOpen(false)} onLeft={() => onRemoved?.()} />
    ) : null}
    </>
  );
}
