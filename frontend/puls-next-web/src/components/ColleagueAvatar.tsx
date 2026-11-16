import React, { useEffect, useState } from 'react';
import { loadColleaguePhoto, type ColleagueDto } from '../app/colleagues';
import { ChatAvatar } from './chat/ChatAvatar';
import '../chat.css';

/** Фото коллеги, а пока его нет (или фото не загружено) — цветной кружок с инициалами, как в чате. */
export function ColleagueAvatar({ colleague, size = 48, online }: { colleague: ColleagueDto; size?: number; online?: boolean }) {
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setPhoto(null);
    if (colleague.hasPhoto) {
      void loadColleaguePhoto(colleague.id).then((url) => active && setPhoto(url));
    }

    return () => {
      active = false;
    };
  }, [colleague.id, colleague.hasPhoto]);

  if (!photo) {
    return <ChatAvatar name={colleague.fullName} seed={colleague.id} size={size} online={online} />;
  }

  return (
    <span className="chat-avatar colleague-avatar-photo" style={{ width: size, height: size }} aria-hidden="true">
      <img src={photo} alt="" />
      {online ? <span className="chat-avatar-online" /> : null}
    </span>
  );
}
