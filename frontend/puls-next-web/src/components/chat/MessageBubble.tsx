import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatChatTime, isEmojiOnly, type ChatReadStatus, splitTextWithLinks } from '../../app/chatFormat';
import type { ChatMessageDto } from '../../app/chatTypes';
import { showToast } from '../../app/toast';
import { ChatAttachmentList } from './ChatAttachmentView';
import { QUICK_REACTIONS } from './EmojiPicker';
import { ChatLinkPreview, extractAppLinks, parseAppLink } from './ChatLinkPreview';
import { ChatTicks } from './ChatTicks';
import { ChatContextMenu, ChatMenuGroups, ChatMenuItem, getContextMenuPosition, type ChatMenuPosition } from './ChatContextMenu';
import { splitMentions } from '../../app/chatMentions';
import { openColleagueCard } from '../../app/colleagueCard';
import '../../chat.css';

export function MessageBubble({
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
  onForward,
  mentioned = [],
  mentionsMe = false,
  currentUserId = 0
}: {
  message: ChatMessageDto;
  own: boolean;
  showAuthor: boolean;
  isGroupEnd: boolean;
  canModerate: boolean;
  readStatus: ChatReadStatus | null;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
  onReplyClick: (messageId: number) => void;
  /** null — закреплять нельзя. */
  pinState?: 'pinned' | 'unpinned' | null;
  onTogglePin?: () => void;
  onForward?: () => void;
  mentioned?: Array<{ userId: number; name: string }>;
  mentionsMe?: boolean;
  currentUserId?: number;
}) {
  const [menuAt, setMenuAt] = useState<ChatMenuPosition | null>(null);
  const closeMenu = useCallback(() => setMenuAt(null), []);
  const longPressRef = useRef<number | undefined>(undefined);
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

  const cancelLongPress = () => window.clearTimeout(longPressRef.current);

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    if (message.isDeleted) {
      return;
    }

    // По ссылке и по выделенному тексту остается обычное меню браузера: открыть ссылку, скопировать выделение.
    const target = event.target as HTMLElement;
    const selection = window.getSelection();
    if (target.closest('a') || (selection && !selection.isCollapsed && event.currentTarget.contains(selection.anchorNode))) {
      return;
    }

    event.preventDefault();
    cancelLongPress();
    setMenuAt(getContextMenuPosition(event));
  };

  // На телефоне — долгое нажатие (iOS не присылает contextmenu).
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch' || message.isDeleted) {
      return;
    }

    const point = { x: event.clientX, y: event.clientY };
    cancelLongPress();
    longPressRef.current = window.setTimeout(() => setMenuAt(point), 500);
  };

  useEffect(() => cancelLongPress, []);

  const run = (action: () => void) => () => {
    setMenuAt(null);
    action();
  };

  return (
    <div
      className={`chat-message${own ? ' own' : ''}${isGroupEnd ? ' group-end' : ''}${showAuthor ? ' with-author' : ''}${mentionsMe ? ' mentions-me' : ''}${menuAt ? ' menu-open' : ''}`}
      data-message-id={message.id}
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      onPointerUp={cancelLongPress}
      onPointerMove={(event) => { if (event.pointerType === 'touch') { cancelLongPress(); } }}
      onPointerCancel={cancelLongPress}
    >
      <div className={`chat-bubble${message.isDeleted ? ' deleted' : ''}${bigEmoji ? ' emoji-only' : ''}`}>
        {showAuthor ? (
          <button type="button" className="chat-bubble-author" onClick={() => openColleagueCard(message.senderUserId)} title="Карточка сотрудника">
            {message.senderName}
          </button>
        ) : null}

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
                    return (
                      <React.Fragment key={index}>
                        {splitMentions(part.value, mentioned).map((piece, pieceIndex) => (piece.type === 'mention'
                          ? <span key={pieceIndex} className={`chat-mention${piece.userId === currentUserId ? ' me' : ''}`}>{piece.value}</span>
                          : <React.Fragment key={pieceIndex}>{piece.value}</React.Fragment>))}
                      </React.Fragment>
                    );
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

        {/* Как в Telegram: реакции внутри пузыря внизу, время и галочки — справа в той же строке. */}
        <div className={`chat-bubble-footer${message.reactions.length > 0 ? ' with-reactions' : ''}`}>
          {message.reactions.length > 0 ? (
            <div className="chat-reactions">
              {message.reactions.map((reaction) => (
                <button
                  key={reaction.emoji}
                  type="button"
                  className={`chat-reaction${reaction.reactedByMe ? ' mine' : ''}`}
                  onClick={() => onReact(reaction.emoji)}
                  title={reaction.reactedByMe ? 'Убрать реакцию' : 'Поставить такую же'}
                  aria-label={`${reaction.emoji} ${reaction.count}${reaction.reactedByMe ? ', ваша реакция' : ''}`}
                  aria-pressed={reaction.reactedByMe}
                >
                  <span className="chat-reaction-emoji">{reaction.emoji}</span>
                  <span className="chat-reaction-count">{reaction.count}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="chat-bubble-meta">
            {message.editedAtUtc && !message.isDeleted ? <span title={`Изменено ${formatChatTime(message.editedAtUtc)}`}>изменено</span> : null}
            <span>{formatChatTime(message.createdAtUtc)}</span>
            {readStatus ? <ChatTicks status={readStatus} /> : null}
          </div>
        </div>
      </div>

      {menuAt && !message.isDeleted ? (
        <ChatContextMenu position={menuAt} label="Действия с сообщением" className="chat-message-context" onClose={closeMenu}>
          {/* Группы: ответ и пересылка | копирование, правка, закреп | удаление | реакции. */}
          <ChatMenuGroups
            groups={[
              [
                <ChatMenuItem icon="↩️" onClick={run(onReply)}>Ответить</ChatMenuItem>,
                onForward ? <ChatMenuItem icon="↪️" onClick={run(onForward)}>Переслать</ChatMenuItem> : null
              ],
              [
                message.text ? <ChatMenuItem icon="📋" onClick={run(() => void copy())}>Копировать текст</ChatMenuItem> : null,
                own ? <ChatMenuItem icon="✏️" onClick={run(onEdit)}>Изменить</ChatMenuItem> : null,
                pinState ? (
                  <ChatMenuItem icon="📌" onClick={run(() => onTogglePin?.())}>{pinState === 'pinned' ? 'Открепить' : 'Закрепить'}</ChatMenuItem>
                ) : null
              ],
              [
                own || canModerate ? <ChatMenuItem icon="🗑️" danger onClick={run(onDelete)}>Удалить</ChatMenuItem> : null
              ],
              [
                <div className="chat-context-reactions" role="group" aria-label="Реакции">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      role="menuitem"
                      className={message.reactions.some((reaction) => reaction.emoji === emoji && reaction.reactedByMe) ? 'mine' : ''}
                      onClick={run(() => onReact(emoji))}
                      aria-label={`Реакция ${emoji}`}
                      title={`Реакция ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ]
            ]}
          />
        </ChatContextMenu>
      ) : null}
    </div>
  );
}
