import React, { useEffect, useState } from 'react';
import { TOAST_EVENT, type ToastMessage } from '../app/toast';

export function ToastViewport() {
  const [items, setItems] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const message = (event as CustomEvent<ToastMessage>).detail;
      setItems((current) => [...current, message]);

      window.setTimeout(() => {
        setItems((current) => current.filter((item) => item.id !== message.id));
      }, message.durationMs);
    };

    window.addEventListener(TOAST_EVENT, onToast as EventListener);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast as EventListener);
    };
  }, []);

  return (
    <div className="toast-viewport">
      {items.map((item) => {
        const [title, ...details] = item.message.split('\n').filter(Boolean);

        return (
          <div key={item.id} className={`toast toast-${item.type}`}>
            <strong>{title}</strong>
            {details.length > 0 ? (
              <span>{details.join('\n')}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
