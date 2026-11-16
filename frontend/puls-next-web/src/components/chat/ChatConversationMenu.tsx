import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useChat } from '../../app/ChatContext';
import { markChatRead, updateChatPreferences } from '../../app/chatApi';
import type { ChatConversationDto, ChatConversationPreferencesRequest } from '../../app/chatTypes';
import { isGroupConversation } from '../../app/chatTypes';
import { getApiErrorMessage } from '../../app/apiErrors';
import { showToast } from '../../app/toast';

/**
 * Действия с диалогом из контекстного меню списка (ПКМ или кнопка «⋯» у диалога):
 * закрепить, без звука, отметить прочитанным, информация и настройки, архив.
 */
export function useConversationActions(conversation: ChatConversationDto, onRemoved?: () => void) {
  const chat = useChat();

  const setPreference = async (patch: ChatConversationPreferencesRequest) => {
    try {
      const updated = await updateChatPreferences(conversation.id, patch);
      if (patch.isArchived) {
        chat.removeConversation(conversation.id);
        onRemoved?.();
        showToast('Диалог перенесен в архив. Он вернется, когда придет новое сообщение.', 'info', 4000);
      } else {
        chat.upsertConversation(updated);
      }
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось изменить настройки диалога.'), 'error');
    }
  };

  const markRead = async () => {
    const lastId = conversation.lastMessage?.id ?? 0;
    if (lastId <= 0) {
      return;
    }

    chat.markConversationReadLocally(conversation.id, lastId, 0);
    try {
      await markChatRead(conversation.id, lastId);
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось отметить диалог прочитанным.'), 'error');
      void chat.refreshConversations();
    }
  };

  return { setPreference, markRead };
}

export interface ChatConversationMenuProps {
  conversation: ChatConversationDto;
  /** Точка, где открыть меню (координаты окна). */
  position: { x: number; y: number };
  onClose: () => void;
  onOpenInfo: () => void;
  onRemoved?: () => void;
}

const MARGIN = 8;

export function ChatConversationMenu({ conversation, position, onClose, onOpenInfo, onRemoved }: ChatConversationMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState(position);
  const { setPreference, markRead } = useConversationActions(conversation, onRemoved);
  const isGroup = isGroupConversation(conversation);

  // Меню не должно выходить за окно: у правого или нижнего края открывается влево или вверх.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const { width, height } = element.getBoundingClientRect();
    setPlacement({
      x: Math.max(MARGIN, Math.min(position.x, window.innerWidth - width - MARGIN)),
      y: Math.max(MARGIN, Math.min(position.y, window.innerHeight - height - MARGIN))
    });
    element.querySelector<HTMLButtonElement>('button')?.focus();
  }, [position]);

  useEffect(() => {
    const handlePointer = (event: Event) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const items = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
        items[next]?.focus();
      }
    };
    const close = () => onClose();

    document.addEventListener('mousedown', handlePointer, true);
    document.addEventListener('contextmenu', handlePointer, true);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', handlePointer, true);
      document.removeEventListener('contextmenu', handlePointer, true);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [onClose]);

  const run = (action: () => void | Promise<void>) => () => {
    onClose();
    void action();
  };

  return createPortal(
    <div
      ref={ref}
      className="chat-message-menu chat-conversation-menu"
      role="menu"
      aria-label={`Действия с чатом «${conversation.title}»`}
      style={{ left: placement.x, top: placement.y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button type="button" role="menuitem" onClick={run(() => setPreference({ isPinned: !conversation.isPinned }))}>
        {conversation.isPinned ? '📌 Открепить' : '📌 Закрепить вверху'}
      </button>
      <button type="button" role="menuitem" onClick={run(() => setPreference({ isMuted: !conversation.isMuted }))}>
        {conversation.isMuted ? '🔔 Включить звук' : '🔕 Без звука'}
      </button>
      {conversation.unreadCount > 0 ? (
        <button type="button" role="menuitem" onClick={run(markRead)}>✓ Отметить прочитанным</button>
      ) : null}
      <button type="button" role="menuitem" onClick={run(onOpenInfo)}>
        {isGroup ? '⚙️ Настройки группы' : 'ⓘ О собеседнике'}
      </button>
      <button type="button" role="menuitem" onClick={run(() => setPreference({ isArchived: true }))}>🗄️ В архив</button>
    </div>,
    document.body
  );
}
