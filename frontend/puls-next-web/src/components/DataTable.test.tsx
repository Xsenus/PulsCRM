/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DataTable, type DataTableColumn, type DataTableDisplayMode } from './DataTable';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

interface TestRow {
  id: number;
  name: string;
  email: string;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const rows: TestRow[] = [
  { id: 1, name: 'Alpha', email: 'alpha@example.com' }
];

const columns: Array<DataTableColumn<TestRow>> = [
  {
    key: 'name',
    title: 'Name',
    render: (row) => row.name,
    width: 180,
    canHide: false,
    isPrimary: true
  },
  {
    key: 'email',
    title: 'Email',
    render: (row) => row.email,
    width: 220,
    visible: true,
    mobileLabel: 'Mail',
    priority: 1
  },
  {
    key: 'id',
    title: 'ID',
    render: (row) => row.id,
    width: 100,
    visible: false,
    mobileLabel: 'Identifier',
    priority: 2
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

function renderTable(settingsKey = 'datatable-test-settings', displayMode?: DataTableDisplayMode) {
  return render(
    <DataTable
      rows={rows}
      columns={columns}
      getRowKey={(row) => row.id}
      settingsKey={settingsKey}
      displayMode={displayMode}
      title={<h3>Users</h3>}
    />
  );
}

function click(element: Element) {
  act(() => {
    Simulate.click(element as Element);
  });
}

function changeCheckbox(input: HTMLInputElement, checked: boolean) {
  act(() => {
    Simulate.change(input, { target: { checked } } as any);
  });
}

function getHeaderTexts(view: ParentNode) {
  return Array.from(view.querySelectorAll('thead th .data-table-header-cell span'))
    .map((item) => item.textContent);
}

function getSettingItemByTitle(title: string) {
  return Array.from(document.body.querySelectorAll('.table-settings-item'))
    .find((item) => item.querySelector('strong')?.textContent === title);
}

function getModalActionButton(text: string) {
  return Array.from(document.body.querySelectorAll<HTMLButtonElement>('.modal-actions button'))
    .find((button) => button.textContent?.trim() === text);
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
  document.body.className = '';
  window.localStorage.clear();
});

describe('DataTable settings', () => {
  it('loads stored column visibility and keeps at least one visible column', () => {
    window.localStorage.setItem('datatable-test-settings', JSON.stringify({
      columns: [
        { key: 'name', visible: false, width: 180 },
        { key: 'email', visible: false, width: 220 },
        { key: 'id', visible: false, width: 100 }
      ]
    }));

    const view = renderTable();

    expect(getHeaderTexts(view)).toEqual(['Name']);
    expect(view.querySelector('.data-table')?.textContent).toContain('Alpha');
    expect(view.querySelector('.data-table')?.textContent).not.toContain('alpha@example.com');
  });

  it('renders cards mode independently from stored table visibility', () => {
    window.localStorage.setItem('datatable-test-settings', JSON.stringify({
      columns: [
        { key: 'name', visible: true, width: 180 },
        { key: 'email', visible: false, width: 220 },
        { key: 'id', visible: true, width: 100 }
      ]
    }));

    const view = renderTable('datatable-test-settings', 'cards');

    expect(view.querySelector('.data-table')).toBeNull();
    expect(view.querySelector('.data-table-action-button')).toBeNull();
    expect(view.querySelector('.data-table-card-title')?.textContent).toBe('Alpha');
    expect(view.querySelector('.data-table-card-fields')?.textContent).toContain('Mail');
    expect(view.querySelector('.data-table-card-fields')?.textContent).toContain('alpha@example.com');
    expect(view.querySelector('.data-table-card-fields')?.textContent).not.toContain('Identifier');
  });

  it('keeps table mode forced on small-screen CSS contracts', () => {
    const view = renderTable('datatable-test-settings', 'table');

    expect(view.querySelector('.table-shell')?.className).toContain('data-table-mode-table');
    expect(view.querySelector('.data-table')).not.toBeNull();
    expect(view.querySelector('.data-table-card-list')).toBeNull();
    expect(view.querySelector('.data-table-action-button')).not.toBeNull();
  });

  it('saves draft visibility only after confirmation', () => {
    const view = renderTable();

    click(view.querySelector('.data-table-action-button')!);

    const emailItem = getSettingItemByTitle('Email')!;
    const emailCheckbox = emailItem.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    changeCheckbox(emailCheckbox, false);

    expect(getHeaderTexts(view)).toEqual(['Name', 'Email']);

    click(getModalActionButton('Обновить')!);
    click(getModalActionButton('Подтвердить')!);

    expect(getHeaderTexts(view)).toEqual(['Name']);

    const stored = JSON.parse(window.localStorage.getItem('datatable-test-settings') ?? '{}') as {
      columns: Array<{ key: string; visible: boolean; width: number }>;
    };

    expect(stored.columns.find((column) => column.key === 'email')?.visible).toBe(false);
  });

  it('labels column visibility toggles in table settings', () => {
    const view = renderTable();

    click(view.querySelector('.data-table-action-button')!);

    expect(document.body.querySelector('[aria-label="Показать колонку Name"]')).toBeInstanceOf(HTMLInputElement);
    expect(document.body.querySelector('[aria-label="Показать колонку Email"]')).toBeInstanceOf(HTMLInputElement);
    expect(document.body.querySelector('[aria-label="Показать колонку ID"]')).toBeInstanceOf(HTMLInputElement);
  });

  it('resets saved settings to default columns after confirmation', () => {
    window.localStorage.setItem('datatable-test-settings', JSON.stringify({
      columns: [
        { key: 'name', visible: true, width: 180 },
        { key: 'email', visible: false, width: 220 },
        { key: 'id', visible: true, width: 100 }
      ]
    }));

    const view = renderTable();

    expect(getHeaderTexts(view)).toEqual(['Name', 'ID']);

    click(view.querySelector('.data-table-action-button')!);
    click(getModalActionButton('Сбросить')!);
    click(getModalActionButton('Подтвердить')!);

    expect(getHeaderTexts(view)).toEqual(['Name', 'Email']);

    const stored = JSON.parse(window.localStorage.getItem('datatable-test-settings') ?? '{}') as {
      columns: Array<{ key: string; visible: boolean; width: number }>;
    };

    expect(stored.columns.find((column) => column.key === 'email')?.visible).toBe(true);
    expect(stored.columns.find((column) => column.key === 'id')?.visible).toBe(false);
  });
});
