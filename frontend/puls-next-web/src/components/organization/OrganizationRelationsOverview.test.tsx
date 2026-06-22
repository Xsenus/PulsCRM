/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OrganizationRelationsOverview,
  type OrganizationRelationsOverviewItem
} from './OrganizationRelationsOverview';

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

const cards: OrganizationRelationsOverviewItem[] = [
  {
    key: 'contacts',
    title: 'Контакты',
    count: 2,
    description: 'Люди и способы связи',
    items: [
      { key: '1', title: 'Иван Иванов', caption: 'Директор' },
      { key: '2', title: 'office@example.test', caption: 'Email' }
    ]
  },
  {
    key: 'contracts',
    title: 'Договоры',
    count: 0,
    description: 'Договорные записи',
    items: []
  }
];

describe('OrganizationRelationsOverview', () => {
  it('renders relation preview cards and inline tabs', () => {
    const view = render(<OrganizationRelationsOverview cards={cards} activeTab="contacts" onChange={vi.fn()} />);
    const previewCards = Array.from(view.querySelectorAll('.organization-preview-card'));
    const tabs = Array.from(view.querySelectorAll('.settings-tab'));
    const tablist = view.querySelector('[role="tablist"]');

    expect(view.textContent).toContain('Связанные записи');
    expect(view.textContent).toContain('Быстрые карточки и полный список по каждому разделу');
    expect(previewCards).toHaveLength(2);
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Контакты', 'Договоры']);
    expect(tablist?.getAttribute('aria-label')).toBe('Связанные данные организации');
    expect(tabs.map((tab) => tab.getAttribute('role'))).toEqual(['tab', 'tab']);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(tabs.map((tab) => tab.getAttribute('aria-label'))).toEqual(['Контакты: 2; выбрано', 'Договоры: 0; открыть раздел']);
    expect(previewCards[0].className).toContain('active');
    expect(tabs[0].className).toContain('active');
    expect(view.textContent).toContain('Пока пусто.');
  });

  it('calls onChange from cards and tabs', () => {
    const onChange = vi.fn();
    const view = render(<OrganizationRelationsOverview cards={cards} activeTab="contacts" onChange={onChange} />);
    const previewCards = Array.from(view.querySelectorAll('.organization-preview-card'));
    const tabs = Array.from(view.querySelectorAll('.settings-tab'));

    click(previewCards[1]);
    click(tabs[1]);

    expect(onChange).toHaveBeenNthCalledWith(1, 'contracts');
    expect(onChange).toHaveBeenNthCalledWith(2, 'contracts');
  });
});
