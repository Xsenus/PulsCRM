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
});
