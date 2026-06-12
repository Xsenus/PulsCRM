/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { OrganizationDetailsDto } from '../../app/types';
import { OrganizationHistoryWorkspace } from './OrganizationHistoryWorkspace';
import type { OrganizationHistoryTab } from './OrganizationHistoryTabs';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function makeDetails(): OrganizationDetailsDto {
  return {
    id: 1,
    name: 'Пульс',
    visible: true,
    isManager: false,
    emails: ['info@example.test'],
    emailCount: 1,
    contactCount: 1,
    openWorkItems: 0,
    debtAmount: 0,
    debtActualAmount: 0,
    debtMinus6Amount: 0,
    salaryEnabled: false,
    oneCAccountingEnabled: false,
    oneCSalaryEnabled: false,
    oneCHousingEnabled: false,
    salaryDatabaseCount: 0,
    salaryOrganizationCount: 0,
    salaryExtraWorkplaces: 0,
    oneCBaseContract: false,
    oneCItsCompleted: false,
    siteOnSupport: false,
    siteLicenseCompleted: false,
    createdByName: 'Администратор',
    updatedByName: 'Оператор',
    contacts: [],
    tasks: [],
    oneCSnapshots: [
      {
        key: 'snapshot-a',
        title: 'Снимок А',
        code: 'A',
        name: 'Организация А',
        phone: '+7'
      },
      {
        key: 'snapshot-b',
        title: 'Снимок Б',
        code: 'B',
        name: 'Организация Б'
      }
    ],
    programInfos: [],
    events: [
      {
        id: 1,
        eventDateUtc: '2026-06-12T03:00:00Z',
        userName: 'Оператор',
        categoryName: 'Поддержка',
        taskName: 'Продление',
        name: 'Продлить лицензию',
        comment: 'Комментарий события',
        isInProcess: true,
        isCompleted: false
      }
    ],
    contracts: [],
    attachments: [],
    realizations: [],
    parusLicenses: [],
    parusOrders: []
  };
}

function render(ui: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);

  act(() => {
    root = createRoot(container!);
    root.render(ui);
  });

  return container;
}

function renderWorkspace(activeTab: OrganizationHistoryTab, details: OrganizationDetailsDto | null = makeDetails()) {
  return render(<OrganizationHistoryWorkspace activeTab={activeTab} details={details} emailCount={2} eventsSettingsKey="history-events-test" />);
}

function click(element: Element) {
  act(() => {
    Simulate.click(element);
  });
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

describe('OrganizationHistoryWorkspace', () => {
  it('renders events timeline by default and switches to table mode', () => {
    const view = renderWorkspace('events');

    expect(view.textContent).toContain('События организации');
    expect(view.textContent).toContain('1 записей');
    expect(view.querySelector('.organization-timeline-item')?.textContent).toContain('Продлить лицензию');

    const tableButton = Array.from(view.querySelectorAll('button')).find((button) => button.textContent === 'Таблица');
    click(tableButton!);

    expect(view.querySelector('.organization-timeline-item')).toBeNull();
    expect(view.querySelector('.data-table')?.textContent).toContain('Продлить лицензию');
    expect(view.querySelector('.data-table')?.textContent).toContain('Да');
    expect(view.querySelector('.data-table')?.textContent).toContain('Нет');
  });

  it('renders first snapshot and switches active snapshot', () => {
    const view = renderWorkspace('snapshots');

    expect(view.textContent).toContain('Снимок А');
    expect(view.textContent).toContain('Организация А');

    const secondSnapshotButton = Array.from(view.querySelectorAll('button')).find((button) => button.textContent === 'Снимок Б');
    click(secondSnapshotButton!);

    expect(view.textContent).toContain('Организация Б');
  });

  it('renders snapshots empty state when snapshots are missing', () => {
    const details = makeDetails();
    details.oneCSnapshots = [];

    const view = renderWorkspace('snapshots', details);

    expect(view.querySelector('.empty-state')?.textContent).toBe('Снимки 1С по организации не найдены.');
  });

  it('renders audit summary with provided email count', () => {
    const view = renderWorkspace('audit');

    expect(view.textContent).toContain('Создано');
    expect(view.textContent).toContain('Администратор');
    expect(view.textContent).toContain('Email-адресов2');
  });
});
