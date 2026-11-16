import { useChat } from '../../app/ChatContext';
import { markChatRead, updateChatPreferences } from '../../app/chatApi';
import type { ChatConversationDto, ChatConversationPreferencesRequest } from '../../app/chatTypes';
import { isGroupConversation } from '../../app/chatTypes';
import { getApiErrorMessage } from '../../app/apiErrors';
import { showToast } from '../../app/toast';
import { ChatContextMenu, ChatMenuGroups, type ChatMenuPosition } from './ChatContextMenu';

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
  position: ChatMenuPosition;
  onClose: () => void;
  onOpenInfo: () => void;
  onRemoved?: () => void;
}

export function ChatConversationMenu({ conversation, position, onClose, onOpenInfo, onRemoved }: ChatConversationMenuProps) {
  const { setPreference, markRead } = useConversationActions(conversation, onRemoved);
  const isGroup = isGroupConversation(conversation);

  const run = (action: () => void | Promise<void>) => () => {
    onClose();
    void action();
  };

  return (
    <ChatContextMenu position={position} label={`Действия с чатом «${conversation.title}»`} className="chat-conversation-menu" onClose={onClose}>
      <ChatMenuGroups
        groups={[
          [
            <button type="button" role="menuitem" onClick={run(() => setPreference({ isPinned: !conversation.isPinned }))}>
              {conversation.isPinned ? '📌 Открепить' : '📌 Закрепить вверху'}
            </button>,
            <button type="button" role="menuitem" onClick={run(() => setPreference({ isMuted: !conversation.isMuted }))}>
              {conversation.isMuted ? '🔔 Включить звук' : '🔕 Без звука'}
            </button>,
            conversation.unreadCount > 0 ? <button type="button" role="menuitem" onClick={run(markRead)}>✓ Отметить прочитанным</button> : null
          ],
          [
            <button type="button" role="menuitem" onClick={run(onOpenInfo)}>
              {isGroup ? '⚙️ Настройки группы' : 'ⓘ О собеседнике'}
            </button>
          ],
          [<button type="button" role="menuitem" onClick={run(() => setPreference({ isArchived: true }))}>🗄️ В архив</button>]
        ]}
      />
    </ChatContextMenu>
  );
}
