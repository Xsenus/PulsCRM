/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrganizationEventViewModeTabs, type OrganizationEventViewMode } from './OrganizationEventViewModeTabs';

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

describe('OrganizationEventViewModeTabs', () => {
  it('renders event view modes and marks the active mode', () => {
    const view = render(<OrganizationEventViewModeTabs activeMode="table" onChange={vi.fn()} />);
    const buttons = Array.from(view.querySelectorAll('button'));

    expect(buttons.map((button) => button.textContent)).toEqual(['Лента', 'Таблица']);
    expect(buttons.map((button) => button.className.includes('active'))).toEqual([false, true]);
  });

  it('emits selected event view mode on click', () => {
    const onChange = vi.fn();
    const view = render(<OrganizationEventViewModeTabs activeMode="timeline" onChange={onChange} />);
    const buttons = Array.from(view.querySelectorAll('button'));

    buttons.forEach((button) => click(button));

    expect(onChange.mock.calls.map(([mode]) => mode as OrganizationEventViewMode)).toEqual(['timeline', 'table']);
  });
});
