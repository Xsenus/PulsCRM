import React from 'react';
import type { ChatReadStatus } from '../../app/chatFormat';

const LABELS: Record<ChatReadStatus, string> = {
  sent: 'Отправлено',
  delivered: 'Доставлено',
  read: 'Прочитано'
};

/** Галочки своего сообщения: одна серая — отправлено, две серые — доставлено, две синие — прочитано. */
export function ChatTicks({ status, className = '' }: { status: ChatReadStatus; className?: string }) {
  const label = LABELS[status];
  return (
    <span className={`chat-ticks ${status}${className ? ` ${className}` : ''}`} title={label} aria-label={label} role="img">
      <svg viewBox="0 0 18 11" width="18" height="11" aria-hidden="true" focusable="false">
        {status === 'sent' ? (
          <path d="M4.5 5.6 7.3 8.4 13.4 2.3" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <>
            <path d="M1.2 5.6 4 8.4 10.1 2.3" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7.4 8.4 13.5 2.3" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6.2 7.2 7.4 8.4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </svg>
    </span>
  );
}
