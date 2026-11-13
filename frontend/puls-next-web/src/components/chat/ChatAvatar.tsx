import React from 'react';
import { getAvatarColor, getChatInitials } from '../../app/chatFormat';

interface ChatAvatarProps {
  name: string;
  seed: number | string;
  icon?: string | null;
  size?: number;
  online?: boolean;
  group?: boolean;
}

export function ChatAvatar({ name, seed, icon, size = 40, online, group }: ChatAvatarProps) {
  return (
    <span
      className={`chat-avatar${group ? ' chat-avatar-group' : ''}`}
      style={{ width: size, height: size, fontSize: icon ? size * 0.5 : size * 0.38, background: icon ? '#eef4ff' : getAvatarColor(seed) }}
      aria-hidden="true"
    >
      {icon || getChatInitials(name)}
      {online ? <span className="chat-avatar-online" /> : null}
    </span>
  );
}
