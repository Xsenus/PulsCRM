/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrganizationViewTabs, type OrganizationViewTab } from './OrganizationViewTabs';

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
    Simulate.click(element as Element);
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

describe('OrganizationViewTabs', () => {
  it('renders all workspace tabs and marks the active one', () => {
    const view = render(<OrganizationViewTabs activeTab="relations" onChange={vi.fn()} />);
    const buttons = Array.from(view.querySelectorAll('button'));
    const tablist = view.querySelector('[role="tablist"]');

    expect(buttons.map((button) => button.textContent)).toEqual(['Карточка', 'Сопровождение', 'Связи', 'История']);
    expect(tablist?.getAttribute('aria-label')).toBe('Разделы карточки организации');
    expect(buttons.map((button) => button.getAttribute('role'))).toEqual(['tab', 'tab', 'tab', 'tab']);
    expect(buttons.map((button) => button.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true', 'false']);
    expect(buttons.map((button) => button.className.includes('active'))).toEqual([false, false, true, false]);
  });

  it('emits selected tab key on click', () => {
    const onChange = vi.fn();
    const view = render(<OrganizationViewTabs activeTab="profile" onChange={onChange} />);
    const buttons = Array.from(view.querySelectorAll('button'));

    buttons.forEach((button) => click(button));

    expect(onChange.mock.calls.map(([tab]) => tab as OrganizationViewTab)).toEqual(['profile', 'support', 'relations', 'history']);
  });
});
