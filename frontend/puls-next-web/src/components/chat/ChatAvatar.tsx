import React, { useEffect, useState } from 'react';
import { getAvatarColor, getChatInitials } from '../../app/chatFormat';
import { loadUserPhoto } from '../../app/colleagues';

interface ChatAvatarProps {
  name: string;
  seed: number | string;
  icon?: string | null;
  size?: number;
  online?: boolean;
  group?: boolean;
  /** Сотрудник: если в справочнике у него есть фото — показываем фото вместо инициалов. */
  userId?: number | null;
}

/** Фото сотрудника для аватара; null — фото нет (или еще не загружено). */
function useUserPhoto(userId: number | null | undefined) {
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setPhoto(null);
    if (userId && userId > 0) {
      void loadUserPhoto(userId).then((url) => active && setPhoto(url));
    }

    return () => {
      active = false;
    };
  }, [userId]);

  return photo;
}

export function ChatAvatar({ name, seed, icon, size = 40, online, group, userId }: ChatAvatarProps) {
  const photo = useUserPhoto(group || icon ? null : userId);

  return (
    <span
      className={`chat-avatar${group ? ' chat-avatar-group' : ''}${photo ? ' chat-avatar-photo' : ''}`}
      style={{ width: size, height: size, fontSize: icon ? size * 0.5 : size * 0.38, background: photo ? '#e2e8f0' : icon ? '#eef4ff' : getAvatarColor(seed) }}
      aria-hidden="true"
    >
      {photo ? <img src={photo} alt="" /> : icon || getChatInitials(name)}
      {online ? <span className="chat-avatar-online" /> : null}
    </span>
  );
}
