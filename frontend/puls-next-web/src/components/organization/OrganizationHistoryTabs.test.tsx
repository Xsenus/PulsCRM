/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrganizationHistoryTabs, type OrganizationHistoryTab } from './OrganizationHistoryTabs';

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

describe('OrganizationHistoryTabs', () => {
  it('renders all history tabs and marks the active one', () => {
    const view = render(<OrganizationHistoryTabs activeTab="snapshots" onChange={vi.fn()} />);
    const buttons = Array.from(view.querySelectorAll('button'));
    const tablist = view.querySelector('[role="tablist"]');

    expect(buttons.map((button) => button.textContent)).toEqual(['События', 'Снимки 1С', 'Аудит']);
    expect(tablist?.getAttribute('aria-label')).toBe('История организации');
    expect(buttons.map((button) => button.getAttribute('role'))).toEqual(['tab', 'tab', 'tab']);
    expect(buttons.map((button) => button.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(buttons.map((button) => button.className.includes('active'))).toEqual([false, true, false]);
  });

  it('emits selected history tab key on click', () => {
    const onChange = vi.fn();
    const view = render(<OrganizationHistoryTabs activeTab="events" onChange={onChange} />);
    const buttons = Array.from(view.querySelectorAll('button'));

    buttons.forEach((button) => click(button));

    expect(onChange.mock.calls.map(([tab]) => tab as OrganizationHistoryTab)).toEqual(['events', 'snapshots', 'audit']);
  });
});
