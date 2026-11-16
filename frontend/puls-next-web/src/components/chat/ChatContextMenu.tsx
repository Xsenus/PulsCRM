import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ChatMenuPosition {
  x: number;
  y: number;
}

const MARGIN = 8;

/**
 * Координаты для контекстного меню из события contextmenu. С клавиатуры (клавиша меню, Shift+F10)
 * координат нет — тогда меню открывается у самого элемента.
 */
export function getContextMenuPosition(event: { clientX: number; clientY: number; currentTarget: Element }): ChatMenuPosition {
  if (event.clientX === 0 && event.clientY === 0) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: rect.left + 24, y: rect.top + Math.min(rect.height, 40) };
  }

  return { x: event.clientX, y: event.clientY };
}

/**
 * Контекстное меню у курсора поверх всего (в том числе плавающего окна чата): не выходит за край экрана,
 * ↑/↓ — пункты; Escape, клик мимо, прокрутка колесом или пальцем и смена размера окна — закрывают.
 */
export function ChatContextMenu({ position, label, className = '', onClose, children }: {
  position: ChatMenuPosition;
  label: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState(position);

  // У правого или нижнего края меню открывается влево или вверх.
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
    element.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus({ preventScroll: true });
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
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const items = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
        if (items.length === 0) {
          return;
        }

        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
        items[next]?.focus();
      }
    };
    const close = () => onClose();
    // Закрываем только на прокрутку пользователем (колесо, свайп): лента прокручивается и сама —
    // догружаются картинки, приходят сообщения, — и меню не должно от этого пропадать.
    const closeOnUserScroll = (event: Event) => {
      if (!ref.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointer, true);
    document.addEventListener('touchstart', handlePointer, true);
    document.addEventListener('contextmenu', handlePointer, true);
    document.addEventListener('keydown', handleKey, true);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    document.addEventListener('wheel', closeOnUserScroll, { capture: true, passive: true });
    document.addEventListener('touchmove', closeOnUserScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('mousedown', handlePointer, true);
      document.removeEventListener('touchstart', handlePointer, true);
      document.removeEventListener('contextmenu', handlePointer, true);
      document.removeEventListener('keydown', handleKey, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
      document.removeEventListener('wheel', closeOnUserScroll, true);
      document.removeEventListener('touchmove', closeOnUserScroll, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className={`chat-message-menu chat-context-menu ${className}`}
      role="menu"
      aria-label={label}
      style={{ left: placement.x, top: placement.y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </div>,
    document.body
  );
}
