export type ChatConversationKind = 'Direct' | 'Group' | 0 | 1;
export type ChatParticipantRole = 'Member' | 'Admin' | 'Owner' | 0 | 1 | 2;
export type ChatMessageKind = 'Text' | 'System' | 0 | 1;

export interface ChatStatusDto {
  enabled: boolean;
  currentUserId: number;
  maxAttachmentBytes: number;
  maxAttachmentsPerMessage: number;
  maxMessageLength: number;
}

export interface ChatUserDto {
  id: number;
  login: string;
  displayName: string;
  groupName?: string | null;
  isInactive: boolean;
}

export interface ChatParticipantDto {
  userId: number;
  displayName: string;
  login?: string | null;
  role: ChatParticipantRole;
  isInactive: boolean;
  lastReadMessageId: number;
  lastReadAtUtc?: string | null;
}

export interface ChatAttachmentDto {
  id: number;
  conversationId: number;
  messageId?: number | null;
  fileName: string;
  contentType: string;
  length: number;
  isImage: boolean;
  uploadedAtUtc: string;
}

export interface ChatReactionDto {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  userIds: number[];
}

export interface ChatReplyPreviewDto {
  id: number;
  senderUserId: number;
  senderName: string;
  text?: string | null;
  isDeleted: boolean;
  attachmentCount: number;
}

export interface ChatMessageDto {
  id: number;
  conversationId: number;
  kind: ChatMessageKind;
  senderUserId: number;
  senderName: string;
  text?: string | null;
  clientMessageId?: string | null;
  createdAtUtc: string;
  editedAtUtc?: string | null;
  isDeleted: boolean;
  replyTo?: ChatReplyPreviewDto | null;
  attachments: ChatAttachmentDto[];
  reactions: ChatReactionDto[];
}

export interface ChatConversationDto {
  id: number;
  kind: ChatConversationKind;
  title: string;
  description?: string | null;
  icon?: string | null;
  peerUserId?: number | null;
  myRole: ChatParticipantRole;
  isMuted: boolean;
  isPinned: boolean;
  isArchived: boolean;
  unreadCount: number;
  myLastReadMessageId: number;
  createdAtUtc: string;
  lastMessageAtUtc: string;
  lastMessage?: ChatMessageDto | null;
  participants: ChatParticipantDto[];
}

export interface ChatMessagePageDto {
  items: ChatMessageDto[];
  hasMoreBefore: boolean;
}

export interface ChatUnreadSummaryDto {
  totalUnread: number;
  conversationsWithUnread: number;
}

export type ChatSoundName = 'chime' | 'pop' | 'ding' | 'bell' | 'soft';

export interface ChatUserSettingsDto {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  soundName: ChatSoundName;
  soundVolume: number;
  showMessagePreview: boolean;
  desktopNotificationsEnabled?: boolean;
}

/** Состояние плавающего окна чата на сервере. */
export interface ChatDockStateDto {
  open: boolean;
  conversationId?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface ChatReadStateEventDto {
  conversationId: number;
  userId: number;
  lastReadMessageId: number;
  lastReadAtUtc?: string | null;
}

export interface ChatTypingEventDto {
  conversationId: number;
  userId: number;
  displayName: string;
}

export interface ChatPresenceEventDto {
  userId: number;
  isOnline: boolean;
}

export interface ChatSendMessageRequest {
  text?: string;
  replyToMessageId?: number | null;
  attachmentIds?: number[];
  clientMessageId?: string;
}

export interface ChatCreateGroupRequest {
  title: string;
  description?: string;
  icon?: string;
  memberUserIds: number[];
}

export interface ChatUpdateGroupRequest {
  title: string;
  description?: string;
  icon?: string;
}

export interface ChatConversationPreferencesRequest {
  isMuted?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
}

/** XPO/ASP.NET отдает enum числом; на случай строкового сериализатора поддерживаем оба варианта. */
export function isGroupConversation(conversation: Pick<ChatConversationDto, 'kind'>) {
  return conversation.kind === 'Group' || conversation.kind === 1;
}

export function isSystemMessage(message: Pick<ChatMessageDto, 'kind'>) {
  return message.kind === 'System' || message.kind === 1;
}

export function roleRank(role: ChatParticipantRole) {
  switch (role) {
    case 'Owner':
    case 2:
      return 2;
    case 'Admin':
    case 1:
      return 1;
    default:
      return 0;
  }
}
