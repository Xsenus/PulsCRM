import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActionIcon } from './ActionIcon';

export interface RowActionItem {
  key: string;
  label: React.ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  danger?: boolean;
}

type MenuHorizontalAlignment = 'start' | 'end';
type MenuVerticalPlacement = 'down' | 'up';
type InitialFocusTarget = 'first' | 'last';

export function RowActionsMenu({
  actions,
  label = 'Действия'
}: {
  actions: RowActionItem[];
  label?: string;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const actionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [horizontalAlignment, setHorizontalAlignment] = useState<MenuHorizontalAlignment>('end');
  const [verticalPlacement, setVerticalPlacement] = useState<MenuVerticalPlacement>('down');
  const [initialFocusTarget, setInitialFocusTarget] = useState<InitialFocusTarget>('first');
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

  const openMenu = (focusTarget: InitialFocusTarget = 'first') => {
    setInitialFocusTarget(focusTarget);
    setOpen(true);
  };

  const toggleMenu = () => {
    setInitialFocusTarget('first');
    setOpen((current) => !current);
  };

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) {
      return;
    }

    const viewportGap = 8;
    const triggerRect = trigger.getBoundingClientRect();
    const menuWidth = menu.offsetWidth || menu.getBoundingClientRect().width;
    const menuHeight = menu.offsetHeight || menu.getBoundingClientRect().height;
    const nextHorizontalAlignment = triggerRect.right - menuWidth < viewportGap ? 'start' : 'end';
    const nextVerticalPlacement = triggerRect.bottom + viewportGap + menuHeight > window.innerHeight
      && triggerRect.top - viewportGap - menuHeight >= viewportGap
      ? 'up'
      : 'down';

    setHorizontalAlignment(nextHorizontalAlignment);
    setVerticalPlacement(nextVerticalPlacement);
  }, [open, actions.length]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (initialFocusTarget === 'last') {
      focusLastAction();
    } else {
      focusFirstAction();
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleViewportChange = () => {
      setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [initialFocusTarget, open]);

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
          toggleMenu();
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            openMenu(event.key === 'ArrowUp' ? 'last' : 'first');
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
        <div
          className={`row-actions-menu-list ${horizontalAlignment} ${verticalPlacement}`}
          ref={menuRef}
          role="menu"
          onKeyDown={handleMenuKeyDown}
        >
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
