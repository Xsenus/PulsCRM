/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoadingButtonLabel } from './AppLoader';
import { RowActionsMenu } from './RowActionsMenu';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(ui: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);

  act(() => {
    root = createRoot(container!);
    root.render(ui);
  });

  return container;
}

function click(element: Element) {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function keyDown(element: Element, key: string) {
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

function rect(overrides: Partial<DOMRect>): DOMRect {
  return {
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...overrides
  };
}

afterEach(() => {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
  }

  root = null;
  container?.remove();
  container = null;
});

describe('RowActionsMenu', () => {
  it('renders node labels and keeps disabled actions inert', () => {
    const onRetry = vi.fn();
    const view = render(
      <RowActionsMenu
        actions={[
          {
            key: 'retry',
            label: <LoadingButtonLabel label="Возвращаем" />,
            disabled: true,
            onClick: onRetry
          }
        ]}
      />
    );

    click(view.querySelector('.row-actions-menu-trigger')!);

    const action = view.querySelector<HTMLButtonElement>('.row-actions-menu-item')!;
    expect(action.disabled).toBe(true);
    expect(action.textContent).toContain('Возвращаем');

    act(() => {
      action.click();
    });

    expect(onRetry).not.toHaveBeenCalled();
  });

  it('links trigger and menu with ARIA and exposes busy actions', () => {
    const onBusy = vi.fn();
    const view = render(
      <RowActionsMenu
        label="Row actions"
        actions={[
          {
            key: 'busy',
            label: 'Processing',
            busy: true,
            onClick: onBusy
          }
        ]}
      />
    );

    const trigger = view.querySelector<HTMLButtonElement>('.row-actions-menu-trigger')!;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    click(trigger);

    const menu = view.querySelector<HTMLElement>('.row-actions-menu-list')!;
    const action = view.querySelector<HTMLButtonElement>('.row-actions-menu-item')!;

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe(menu.id);
    expect(menu.getAttribute('aria-labelledby')).toBe(trigger.id);
    expect(action.disabled).toBe(true);
    expect(action.getAttribute('aria-busy')).toBe('true');
    expect(action.getAttribute('aria-disabled')).toBe('true');

    act(() => {
      action.click();
    });

    expect(onBusy).not.toHaveBeenCalled();
  });

  it('moves focus through enabled actions with keyboard shortcuts', () => {
    const view = render(
      <RowActionsMenu
        actions={[
          { key: 'disabled', label: 'Недоступно', disabled: true, onClick: vi.fn() },
          { key: 'edit', label: 'Редактировать', onClick: vi.fn() },
          { key: 'delete', label: 'Удалить', danger: true, onClick: vi.fn() }
        ]}
      />
    );

    const trigger = view.querySelector<HTMLButtonElement>('.row-actions-menu-trigger')!;
    click(trigger);

    const menu = view.querySelector<HTMLElement>('.row-actions-menu-list')!;
    const actions = Array.from(view.querySelectorAll<HTMLButtonElement>('.row-actions-menu-item'));
    expect(document.activeElement).toBe(actions[1]);

    keyDown(menu, 'ArrowDown');
    expect(document.activeElement).toBe(actions[2]);

    keyDown(menu, 'ArrowDown');
    expect(document.activeElement).toBe(actions[1]);

    keyDown(menu, 'ArrowUp');
    expect(document.activeElement).toBe(actions[2]);

    keyDown(menu, 'Home');
    expect(document.activeElement).toBe(actions[1]);

    keyDown(menu, 'End');
    expect(document.activeElement).toBe(actions[2]);

    keyDown(menu, 'Escape');

    expect(view.querySelector('.row-actions-menu-list')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('opens with ArrowUp and focuses the last enabled action', () => {
    const view = render(
      <RowActionsMenu
        actions={[
          { key: 'edit', label: 'Редактировать', onClick: vi.fn() },
          { key: 'delete', label: 'Удалить', danger: true, onClick: vi.fn() }
        ]}
      />
    );

    const trigger = view.querySelector<HTMLButtonElement>('.row-actions-menu-trigger')!;
    keyDown(trigger, 'ArrowUp');

    const actions = Array.from(view.querySelectorAll<HTMLButtonElement>('.row-actions-menu-item'));
    expect(view.querySelector('.row-actions-menu-list')).not.toBeNull();
    expect(document.activeElement).toBe(actions[1]);
  });

  it('positions the menu inside the viewport when trigger is near edges', () => {
    const originalInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
    const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 280 });
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRectMock() {
      if (this.classList.contains('row-actions-menu-trigger')) {
        return rect({ bottom: 248, height: 38, left: 4, right: 42, top: 210, width: 38 });
      }

      if (this.classList.contains('row-actions-menu-list')) {
        return rect({ height: 80, width: 190 });
      }

      return originalGetBoundingClientRect.call(this);
    };
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get() {
        return this.classList.contains('row-actions-menu-list') ? 190 : 38;
      }
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() {
        return this.classList.contains('row-actions-menu-list') ? 80 : 38;
      }
    });

    try {
      const view = render(
        <RowActionsMenu
          actions={[
            { key: 'edit', label: 'Редактировать', onClick: vi.fn() }
          ]}
        />
      );

      click(view.querySelector('.row-actions-menu-trigger')!);

      const menu = view.querySelector<HTMLElement>('.row-actions-menu-list')!;
      expect(menu.classList.contains('start')).toBe(true);
      expect(menu.classList.contains('up')).toBe(true);
    } finally {
      if (originalInnerHeight) {
        Object.defineProperty(window, 'innerHeight', originalInnerHeight);
      }
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      if (originalOffsetWidth) {
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
      }
      if (originalOffsetHeight) {
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
      }
    }
  });

  it('returns focus to trigger when closed by global Escape', () => {
    const view = render(
      <RowActionsMenu
        actions={[
          { key: 'edit', label: 'Редактировать', onClick: vi.fn() }
        ]}
      />
    );

    const trigger = view.querySelector<HTMLButtonElement>('.row-actions-menu-trigger')!;
    click(trigger);

    expect(view.querySelector('.row-actions-menu-list')).not.toBeNull();

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(view.querySelector('.row-actions-menu-list')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes the menu on viewport changes', () => {
    const view = render(
      <RowActionsMenu
        actions={[
          { key: 'edit', label: 'Редактировать', onClick: vi.fn() }
        ]}
      />
    );

    click(view.querySelector('.row-actions-menu-trigger')!);
    expect(view.querySelector('.row-actions-menu-list')).not.toBeNull();

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(view.querySelector('.row-actions-menu-list')).toBeNull();

    click(view.querySelector('.row-actions-menu-trigger')!);
    expect(view.querySelector('.row-actions-menu-list')).not.toBeNull();

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(view.querySelector('.row-actions-menu-list')).toBeNull();
  });
});
