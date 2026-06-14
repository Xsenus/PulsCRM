import React, { useEffect, useRef, useState } from 'react';
import { ActionIcon } from './ActionIcon';

export interface RowActionItem {
  key: string;
  label: React.ReactNode;
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const actionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  actionRefs.current = actionRefs.current.slice(0, actions.length);

  const focusAction = (index: number) => {
    const enabledActions = actionRefs.current.filter((button): button is HTMLButtonElement => !!button && !button.disabled);
    enabledActions[index]?.focus();
  };

  const focusFirstAction = () => {
    focusAction(0);
  };

  const focusLastAction = () => {
    const enabledActions = actionRefs.current.filter((button): button is HTMLButtonElement => !!button && !button.disabled);
    enabledActions[enabledActions.length - 1]?.focus();
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    focusFirstAction();

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

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape'].includes(event.key)) {
      return;
    }

    event.preventDefault();

    if (event.key === 'Escape') {
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }

    const enabledActions = actionRefs.current.filter((button): button is HTMLButtonElement => !!button && !button.disabled);
    if (enabledActions.length === 0) {
      return;
    }

    if (event.key === 'Home') {
      focusFirstAction();
      return;
    }

    if (event.key === 'End') {
      focusLastAction();
      return;
    }

    const currentIndex = enabledActions.findIndex((button) => button === document.activeElement);
    const nextIndex = event.key === 'ArrowDown'
      ? (currentIndex + 1) % enabledActions.length
      : (currentIndex <= 0 ? enabledActions.length - 1 : currentIndex - 1);

    enabledActions[nextIndex]?.focus();
  };

  return (
    <div className="row-actions-menu" ref={shellRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`secondary-button button-inline icon-button row-actions-menu-trigger${open ? ' active' : ''}`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ActionIcon kind="actions" />
      </button>

      {open ? (
        <div className="row-actions-menu-list" role="menu" onKeyDown={handleMenuKeyDown}>
          {actions.map((action, index) => (
            <button
              key={action.key}
              ref={(element) => {
                actionRefs.current[index] = element;
              }}
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
