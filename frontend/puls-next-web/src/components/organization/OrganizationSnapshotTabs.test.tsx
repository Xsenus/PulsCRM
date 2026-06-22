/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrganizationSnapshotTabs, type OrganizationSnapshotTabItem } from './OrganizationSnapshotTabs';

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

const snapshots: OrganizationSnapshotTabItem[] = [
  { key: 'current', title: 'Текущие реквизиты' },
  { key: 'archive', title: 'Архив 1С' }
];

describe('OrganizationSnapshotTabs', () => {
  it('renders snapshot titles and marks the active snapshot', () => {
    const view = render(<OrganizationSnapshotTabs snapshots={snapshots} activeKey="archive" onChange={vi.fn()} />);
    const buttons = Array.from(view.querySelectorAll('button'));
    const tablist = view.querySelector('[role="tablist"]');

    expect(buttons.map((button) => button.textContent)).toEqual(['Текущие реквизиты', 'Архив 1С']);
    expect(tablist?.getAttribute('aria-label')).toBe('Снимки 1С организации');
    expect(buttons.map((button) => button.getAttribute('role'))).toEqual(['tab', 'tab']);
    expect(buttons.map((button) => button.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Текущие реквизиты: открыть снимок',
      'Архив 1С: текущий снимок'
    ]);
    expect(buttons.map((button) => button.className.includes('active'))).toEqual([false, true]);
  });

  it('emits selected snapshot key on click', () => {
    const onChange = vi.fn();
    const view = render(<OrganizationSnapshotTabs snapshots={snapshots} activeKey="current" onChange={onChange} />);
    const buttons = Array.from(view.querySelectorAll('button'));

    buttons.forEach((button) => click(button));

    expect(onChange.mock.calls.map(([key]) => key as string)).toEqual(['current', 'archive']);
  });

  it('keeps an empty tab container when snapshots are missing', () => {
    const view = render(<OrganizationSnapshotTabs snapshots={[]} onChange={vi.fn()} />);

    expect(view.querySelector('.organization-card-tabs-inline')).not.toBeNull();
    expect(view.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Снимки 1С организации');
    expect(view.querySelectorAll('button')).toHaveLength(0);
  });
});
