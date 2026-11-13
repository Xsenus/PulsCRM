import { api } from './api';
import { throwApiError } from './apiErrors';
import type { ChatImageUploadExtras } from './chatImageThumbnail';
import type {
  ChatAttachmentDto,
  ChatConversationDto,
  ChatConversationPreferencesRequest,
  ChatDockStateDto,
  ChatCreateGroupRequest,
  ChatMessageDto,
  ChatMessagePageDto,
  ChatSendMessageRequest,
  ChatStatusDto,
  ChatUnreadSummaryDto,
  ChatUpdateGroupRequest,
  ChatUserDto,
  ChatUserSettingsDto
} from './chatTypes';

async function call<T>(request: () => Promise<{ data: T }>): Promise<T> {
  try {
    const { data } = await request();
    return data;
  } catch (error) {
    throwApiError(error);
  }
}

export const getChatStatus = () => call(() => api.get<ChatStatusDto>('/api/chat/status'));

export const searchChatUsers = (search: string, take = 30) =>
  call(() => api.get<ChatUserDto[]>('/api/chat/users', { params: { search: search || undefined, take } }));

export const getChatConversations = (includeArchived = false) =>
  call(() => api.get<ChatConversationDto[]>('/api/chat/conversations', { params: { includeArchived } }));

export const getChatConversation = (id: number) =>
  call(() => api.get<ChatConversationDto>(`/api/chat/conversations/${id}`));

export const openDirectChat = (userId: number) =>
  call(() => api.post<ChatConversationDto>('/api/chat/conversations/direct', { userId }));

export const createGroupChat = (request: ChatCreateGroupRequest) =>
  call(() => api.post<ChatConversationDto>('/api/chat/conversations/group', request));

export const updateGroupChat = (id: number, request: ChatUpdateGroupRequest) =>
  call(() => api.put<ChatConversationDto>(`/api/chat/conversations/${id}`, request));

export const addChatMembers = (id: number, userIds: number[]) =>
  call(() => api.post<ChatConversationDto>(`/api/chat/conversations/${id}/members`, { userIds }));

export const removeChatMember = (id: number, userId: number) =>
  call(() => api.delete<ChatConversationDto>(`/api/chat/conversations/${id}/members/${userId}`));

export const setChatMemberRole = (id: number, userId: number, role: 'Member' | 'Admin') =>
  call(() => api.put<ChatConversationDto>(`/api/chat/conversations/${id}/members/${userId}/role`, { role: role === 'Admin' ? 1 : 0 }));

export const leaveChat = (id: number) => call(() => api.post<void>(`/api/chat/conversations/${id}/leave`));

export const updateChatPreferences = (id: number, request: ChatConversationPreferencesRequest) =>
  call(() => api.put<ChatConversationDto>(`/api/chat/conversations/${id}/preferences`, request));

export const getChatMessages = (id: number, before?: number, take = 50) =>
  call(() => api.get<ChatMessagePageDto>(`/api/chat/conversations/${id}/messages`, { params: { before, take } }));

export const sendChatMessage = (id: number, request: ChatSendMessageRequest) =>
  call(() => api.post<ChatMessageDto>(`/api/chat/conversations/${id}/messages`, request));

export const editChatMessage = (messageId: number, text: string) =>
  call(() => api.put<ChatMessageDto>(`/api/chat/messages/${messageId}`, { text }));

export const deleteChatMessage = (messageId: number) =>
  call(() => api.delete<ChatMessageDto>(`/api/chat/messages/${messageId}`));

export const toggleChatReaction = (messageId: number, emoji: string) =>
  call(() => api.post<ChatMessageDto>(`/api/chat/messages/${messageId}/reactions`, { emoji }));

export const markChatRead = (id: number, messageId?: number) =>
  call(() => api.post<void>(`/api/chat/conversations/${id}/read`, { messageId }));

export const getChatUnread = () => call(() => api.get<ChatUnreadSummaryDto>('/api/chat/unread'));

export const getChatSettings = () => call(() => api.get<ChatUserSettingsDto>('/api/chat/settings'));

export const updateChatSettings = (settings: ChatUserSettingsDto) =>
  call(() => api.put<ChatUserSettingsDto>('/api/chat/settings', settings));

export const getChatDockState = () => call(() => api.get<ChatDockStateDto>('/api/chat/dock'));

export const updateChatDockState = (state: ChatDockStateDto) =>
  call(() => api.put<ChatDockStateDto>('/api/chat/dock', state));

export function uploadChatAttachment(
  conversationId: number,
  file: File,
  onProgress?: (percent: number) => void,
  extras: ChatImageUploadExtras = {}
) {
  const formData = new FormData();
  formData.append('file', file);
  if (extras.thumbnail) {
    formData.append('thumbnail', extras.thumbnail, extras.thumbnail.type === 'image/webp' ? 'thumbnail.webp' : 'thumbnail.jpg');
  }

  if (extras.width && extras.height) {
    formData.append('width', String(extras.width));
    formData.append('height', String(extras.height));
  }
  return call(() => api.post<ChatAttachmentDto>(`/api/chat/conversations/${conversationId}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    }
  }));
}

export const deletePendingChatAttachment = (attachmentId: number) =>
  call(() => api.delete<void>(`/api/chat/attachments/${attachmentId}`));

/**
 * Вложения отдаются только с JWT, поэтому &lt;img src&gt; на прямой URL не работает:
 * качаем как blob и показываем через object URL.
 */
export const fetchChatAttachmentBlob = (attachmentId: number, inline: boolean, thumbnail = false) =>
  call(() => api.get<Blob>(`/api/chat/attachments/${attachmentId}`, {
    params: { inline: inline || undefined, thumbnail: thumbnail || undefined },
    responseType: 'blob'
  }));
