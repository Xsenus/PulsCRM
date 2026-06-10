import React, { useEffect, useRef, useState } from 'react';

export interface RowActionItem {
  key: string;
  label: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  danger?: boolean;
}

function ActionsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="19" r="1.8" fill="currentColor" />
    </svg>
  );
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
        <ActionsIcon />
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
