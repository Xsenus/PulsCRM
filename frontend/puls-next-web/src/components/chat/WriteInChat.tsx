import React, { useCallback, useState } from 'react';
import { useOptionalChat } from '../../app/ChatContext';
import { openDirectChat } from '../../app/chatApi';
import { getApiErrorMessage } from '../../app/apiErrors';
import { showToast } from '../../app/toast';

const FIRED_GROUP_NAME = 'уволенные';

/**
 * Открыть личный диалог с сотрудником в плавающем окне чата, не уходя со страницы.
 * canWrite — можно ли показывать действие: чат включен, это не сам пользователь и сотрудник не уволен.
 */
export function useWriteInChat() {
  const chat = useOptionalChat();
  const [busyUserId, setBusyUserId] = useState<number | null>(null);

  const canWrite = useCallback((userId: number | null | undefined, userGroup?: string | null) => (
    !!chat?.enabled
    && !!userId
    && userId !== chat.currentUserId
    && (userGroup ?? '').trim().toLowerCase() !== FIRED_GROUP_NAME
  ), [chat?.currentUserId, chat?.enabled]);

  const write = useCallback(async (userId: number) => {
    if (!chat) {
      return;
    }

    setBusyUserId(userId);
    try {
      const conversation = await openDirectChat(userId);
      chat.upsertConversation(conversation);
      chat.openDock(conversation.id);
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось открыть диалог.'), 'error');
    } finally {
      setBusyUserId(null);
    }
  }, [chat]);

  return { canWrite, write, busyUserId };
}

export function WriteInChatButton({ userId, userGroup, className }: { userId: number | null | undefined; userGroup?: string | null; className?: string }) {
  const { canWrite, write, busyUserId } = useWriteInChat();
  if (!canWrite(userId, userGroup)) {
    return null;
  }

  return (
    <button
      type="button"
      className={className ?? 'secondary-button button-inline'}
      onClick={() => void write(userId!)}
      disabled={busyUserId === userId}
      title="Открыть личный диалог в окне чата"
    >
      💬 Написать
    </button>
  );
}
