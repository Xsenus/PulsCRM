import React, { useEffect, useRef, useState } from 'react';
import { ActionIcon } from './ActionIcon';

export interface RowActionItem {
  key: string;
  label: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  danger?: boolean;
}

export function RowActionsMenu({
  actions,
  label = 'Действия'
}: {
  actions: RowActionItem[];
  label?: string;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="row-actions-menu" ref={shellRef}>
      <button
        type="button"
        className={`secondary-button button-inline icon-button row-actions-menu-trigger${open ? ' active' : ''}`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ActionIcon kind="actions" />
      </button>

      {open ? (
        <div className="row-actions-menu-list" role="menu">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              className={`row-actions-menu-item${action.danger ? ' danger' : ''}`}
              disabled={action.disabled}
              role="menuitem"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                void action.onClick();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
