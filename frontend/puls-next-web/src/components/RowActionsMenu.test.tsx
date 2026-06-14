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
});
