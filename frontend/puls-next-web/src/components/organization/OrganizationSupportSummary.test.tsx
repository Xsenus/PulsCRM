/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { OrganizationSupportSummary, type OrganizationSupportSummaryItem } from './OrganizationSupportSummary';

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

const items: OrganizationSupportSummaryItem[] = [
  {
    key: 'onec',
    title: '1С',
    tone: 'ok',
    value: 'Лицензия актуальна',
    hint: 'Запас 45 дн.'
  },
  {
    key: 'site',
    title: 'Сайт',
    tone: 'warn',
    value: 'Скоро закончится',
    hint: 'Осталось 10 дн.'
  },
  {
    key: 'ecp',
    title: 'ЭЦП',
    tone: 'muted',
    value: 'Реквизиты не заполнены',
    hint: 'Банк и соглашение ПФР'
  }
];

describe('OrganizationSupportSummary', () => {
  it('renders summary cards with status tone classes', () => {
    const view = render(<OrganizationSupportSummary items={items} />);
    const summaryList = view.querySelector('[role="list"]');
    const cards = Array.from(view.querySelectorAll('.organization-support-summary-card'));
    const pills = Array.from(view.querySelectorAll('.organization-status-pill'));

    expect(summaryList?.getAttribute('aria-label')).toBe('Сводка сопровождения организации');
    expect(view.querySelectorAll('[role="listitem"]')).toHaveLength(3);
    expect(cards).toHaveLength(3);
    expect(view.textContent).toContain('Лицензия актуальна');
    expect(view.textContent).toContain('Осталось 10 дн.');
    expect(view.textContent).toContain('Реквизиты не заполнены');
    expect(pills.map((pill) => pill.className)).toEqual([
      'organization-status-pill organization-status-pill--ok',
      'organization-status-pill organization-status-pill--warn',
      'organization-status-pill organization-status-pill--muted'
    ]);
    expect(pills.map((pill) => pill.getAttribute('role'))).toEqual(['status', 'status', 'status']);
  });

  it('keeps an empty summary grid when items are missing', () => {
    const view = render(<OrganizationSupportSummary items={[]} />);

    expect(view.querySelector('.organization-support-summary-grid')?.getAttribute('role')).toBe('list');
    expect(view.querySelectorAll('.organization-support-summary-card')).toHaveLength(0);
    expect(view.querySelectorAll('[role="listitem"]')).toHaveLength(0);
  });
});
