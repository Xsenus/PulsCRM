/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OrganizationUpsertRequest } from '../../app/types';
import { OrganizationRecordMain } from './OrganizationRecordMain';
import type { OrganizationHistoryTab } from './OrganizationHistoryTabs';
import type { OrganizationRelationTab } from './OrganizationRelationsOverview';
import type { OrganizationViewTab } from './OrganizationViewTabs';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const draft: OrganizationUpsertRequest = {
  name: 'Пульс',
  visible: true,
  isManager: false,
  salaryEnabled: false,
  oneCAccountingEnabled: false,
  oneCSalaryEnabled: false,
  oneCHousingEnabled: false
};

function render(ui: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);

  act(() => {
    root = createRoot(container!);
    root.render(ui);
  });

  return container;
}

function renderMain(activeTab: OrganizationViewTab) {
  return render(
    <OrganizationRecordMain
      activeTab={activeTab}
      details={null}
      draft={draft}
      lookups={null}
      disabled={false}
      relationTab={'contacts' satisfies OrganizationRelationTab}
      historyTab={'events' satisfies OrganizationHistoryTab}
      emailCount={0}
      tableSettings={{
        events: 'test-events',
        contacts: 'test-contacts',
        documents: 'test-documents',
        contracts: 'test-contracts',
        realizations: 'test-realizations',
        licenses: 'test-licenses',
        orders: 'test-orders'
      }}
      onDraftChange={vi.fn()}
      onRelationTabChange={vi.fn()}
      onHistoryTabChange={vi.fn()}
    />
  );
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

describe('OrganizationRecordMain', () => {
  it('renders profile tab content', () => {
    const view = renderMain('profile');

    expect(view.querySelector('.organization-record-main')).not.toBeNull();
    expect(view.textContent).toContain('Основные реквизиты');
    expect(view.textContent).toContain('Контактные данные');
    expect(view.textContent).toContain('Руководитель и служебные реквизиты');
    expect(view.textContent).toContain('Legacy-заметки');
  });

  it('renders support tab content', () => {
    const view = renderMain('support');

    expect(view.textContent).toContain('ЭЦП');
    expect(view.textContent).toContain('Продукты и сопровождение');
    expect(view.textContent).toContain('Блоки программ');
  });

  it('renders relations empty state before organization is saved', () => {
    const view = renderMain('relations');
    const emptyState = view.querySelector('.empty-state');

    expect(emptyState?.getAttribute('role')).toBe('status');
    expect(emptyState?.textContent).toBe('Связанные данные появятся после сохранения организации.');
  });

  it('renders history empty state before organization is saved', () => {
    const view = renderMain('history');
    const emptyState = view.querySelector('.empty-state');

    expect(emptyState?.getAttribute('role')).toBe('status');
    expect(emptyState?.textContent).toBe('История станет доступна после первого сохранения карточки.');
  });
});
