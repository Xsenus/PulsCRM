/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { OrganizationListItemDto } from '../app/types';
import { OrganizationsTable } from './OrganizationsTable';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const rows: OrganizationListItemDto[] = [
  {
    id: 201,
    name: 'Mobile Org',
    smallName: 'Mobile Org',
    fullName: 'Mobile Organization Full Name',
    inn: '5400000000',
    raionId: 301,
    raion: 'Central',
    orgTypeId: 401,
    orgType: 'Client',
    visible: false,
    isManager: true,
    emails: ['org@example.test'],
    emailCount: 2,
    contactCount: 4,
    openWorkItems: 3
  }
];

function render(ui: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);

  act(() => {
    root = createRoot(container!);
    root.render(ui);
  });

  return container;
}

function renderTable(settingsKey = 'organizations-table-test-settings') {
  return render(
    <OrganizationsTable
      rows={rows}
      settingsKey={settingsKey}
      mobileActions={() => <button type="button">Открыть</button>}
    />
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
  }

  root = null;
  container?.remove();
  container = null;
  window.localStorage.clear();
});

describe('OrganizationsTable', () => {
  it('renders readable mobile card fields with counters and actions', () => {
    const view = renderTable();
    const card = view.querySelector('.data-table-card')!;
    const cardText = card.textContent ?? '';

    expect(card.querySelector('.data-table-card-title')?.textContent).toBe('Mobile Org');
    expect(cardText).toContain('ИНН');
    expect(cardText).toContain('5400000000');
    expect(cardText).toContain('Район');
    expect(cardText).toContain('Central');
    expect(cardText).toContain('Тип');
    expect(cardText).toContain('Client');
    expect(cardText).toContain('Email');
    expect(cardText).toContain('2');
    expect(cardText).toContain('Контакты');
    expect(cardText).toContain('4');
    expect(cardText).toContain('Открытых задач');
    expect(cardText).toContain('3');
    expect(cardText).toContain('Видимость');
    expect(cardText).toContain('Скрыта');
    expect(cardText).toContain('Открыть');
  });

  it('keeps management state as an optional table-only badge', () => {
    window.localStorage.setItem('organizations-table-test-settings', JSON.stringify({
      columns: [
        { key: 'name', visible: true, width: 320 },
        { key: 'inn', visible: true, width: 150 },
        { key: 'raion', visible: true, width: 220 },
        { key: 'orgType', visible: true, width: 220 },
        { key: 'openWorkItems', visible: true, width: 150 },
        { key: 'emailCount', visible: true, width: 110 },
        { key: 'contactCount', visible: true, width: 120 },
        { key: 'fullName', visible: false, width: 420 },
        { key: 'visible', visible: true, width: 130 },
        { key: 'isManager', visible: true, width: 150 }
      ]
    }));

    const view = renderTable();

    expect(view.querySelector('.data-table .status-badge-neutral')?.textContent).toBe('Скрыта');
    expect(view.querySelector('.data-table .status-badge-info')?.textContent).toBe('Да');
    expect(view.querySelector('.data-table-card')?.textContent).toContain('Скрыта');
    expect(view.querySelector('.data-table-card')?.textContent).not.toContain('Управленческая');
  });
});
