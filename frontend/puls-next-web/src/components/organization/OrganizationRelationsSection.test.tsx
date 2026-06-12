/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrganizationDetailsDto } from '../../app/types';
import type { OrganizationRelationTab } from './OrganizationRelationsOverview';
import { OrganizationRelationsSection } from './OrganizationRelationsSection';
import type { OrganizationRelationsTableSettings } from './OrganizationRelationsWorkspace';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const tableSettings: OrganizationRelationsTableSettings = {
  contacts: 'relations-section-contacts',
  documents: 'relations-section-documents',
  contracts: 'relations-section-contracts',
  realizations: 'relations-section-realizations',
  licenses: 'relations-section-licenses',
  orders: 'relations-section-orders'
};

function makeDetails(): OrganizationDetailsDto {
  return {
    id: 1,
    name: 'Пульс',
    visible: true,
    isManager: false,
    emails: [],
    emailCount: 0,
    contactCount: 0,
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
    contacts: [{ id: 1, fio: 'Иван Иванов', position: 'Директор', phone: '+7' }],
    tasks: [],
    oneCSnapshots: [],
    programInfos: [],
    events: [],
    contracts: [{
      id: 2,
      name: 'Договор поддержки',
      dateUtc: '2026-06-12T00:00:00Z',
      summa: 1500,
      oneCTransferState: 2,
      isProlongation: false,
      isParus10Tornado: false,
      isOneCHourSupport: false,
      hasItsDiscount: false,
      lawNumber: 0
    }],
    attachments: [{ id: 3, name: 'Акт', attachDocumentTypeName: 'Акт', dateUtc: '2026-06-10T00:00:00Z', isCompleted: true }],
    realizations: [{ id: 4, number: 'R-1', dateUtc: '2026-06-11T00:00:00Z', summa: 200, isDone: true }],
    parusLicenses: [{ id: 5, modification: 'Парус 10', regNumberClient: 'LO-5', dateToUtc: '2026-07-01T00:00:00Z' }],
    parusOrders: [{ id: 6, payer: 'Поставщик', dateUtc: '2026-06-09T00:00:00Z', discount: 0, summa: 300, customerAmount: 350 }]
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

function renderSection(activeTab: OrganizationRelationTab, onChange = vi.fn(), details: OrganizationDetailsDto | null = makeDetails()) {
  return render(<OrganizationRelationsSection activeTab={activeTab} details={details} onChange={onChange} tableSettings={tableSettings} />);
}

function click(element: Element) {
  act(() => {
    Simulate.click(element);
  });
}

function normalizedText(view: ParentNode) {
  return view.textContent?.replace(/\u00a0/g, ' ') ?? '';
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

describe('OrganizationRelationsSection', () => {
  it('builds preview cards and renders active contacts table', () => {
    const view = renderSection('contacts');
    const previewCards = Array.from(view.querySelectorAll('.organization-preview-card'));

    expect(previewCards).toHaveLength(6);
    expect(view.textContent).toContain('Связанные записи');
    expect(view.textContent).toContain('Иван Иванов');
    expect(view.textContent).toContain('Директор');
    expect(view.textContent).toContain('ФИО');
  });

  it('renders active contracts table and formatted preview amount', () => {
    const view = renderSection('contracts');
    const text = normalizedText(view);

    expect(text).toContain('Договор поддержки');
    expect(text).toContain('12.06.2026 • 1 500,00');
    expect(text).toContain('Обработано');
  });

  it('calls onChange from relation tabs', () => {
    const onChange = vi.fn();
    const view = renderSection('contacts', onChange);
    const documentsTab = Array.from(view.querySelectorAll('.settings-tab')).find((tab) => tab.textContent === 'Документы');

    click(documentsTab!);

    expect(onChange).toHaveBeenCalledWith('documents');
  });

  it('renders empty overview and table state without details', () => {
    const view = renderSection('orders', vi.fn(), null);

    expect(view.textContent).toContain('Пока пусто.');
    expect(view.textContent).toContain('Заказов Парус пока нет');
  });
});
