/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { OrganizationDetailsDto } from '../../app/types';
import type { OrganizationRelationTab } from './OrganizationRelationsOverview';
import { OrganizationRelationsWorkspace, type OrganizationRelationsTableSettings } from './OrganizationRelationsWorkspace';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const tableSettings: OrganizationRelationsTableSettings = {
  contacts: 'relations-test-contacts',
  documents: 'relations-test-documents',
  contracts: 'relations-test-contracts',
  realizations: 'relations-test-realizations',
  licenses: 'relations-test-licenses',
  orders: 'relations-test-orders'
};

const baseDetails: OrganizationDetailsDto = {
  id: 1,
  name: 'Организация',
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
  contacts: [],
  tasks: [],
  oneCSnapshots: [],
  programInfos: [],
  events: [],
  contracts: [],
  attachments: [],
  realizations: [],
  parusLicenses: [],
  parusOrders: []
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

function renderWorkspace(activeTab: OrganizationRelationTab, details: OrganizationDetailsDto | null = baseDetails) {
  return render(<OrganizationRelationsWorkspace activeTab={activeTab} details={details} tableSettings={tableSettings} />);
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

describe('OrganizationRelationsWorkspace', () => {
  it('renders contacts table with fallback values', () => {
    const view = renderWorkspace('contacts', {
      ...baseDetails,
      contacts: [{ id: 1, fio: 'Иван Иванов', phone: '+7 383 111-22-33' }]
    });

    expect(view.textContent).toContain('ФИО');
    expect(view.textContent).toContain('Иван Иванов');
    expect(view.textContent).toContain('+7 383 111-22-33');
    expect(view.textContent).toContain('-');
  });

  it('renders documents table with date and completion status', () => {
    const view = renderWorkspace('documents', {
      ...baseDetails,
      attachments: [{
        id: 2,
        executorName: 'Исполнитель',
        fileTypeName: 'PDF',
        dateUtc: '2026-06-12T00:00:00Z',
        number: 'DOC-1',
        isCompleted: false
      }]
    });

    const text = normalizedText(view);

    expect(text).toContain('Тип документа');
    expect(text).toContain('Исполнитель');
    expect(text).toContain('12.06.2026');
    expect(text).toContain('Нет');
    expect(view.querySelector('.data-table time')?.getAttribute('dateTime')).toBe('2026-06-12T00:00:00Z');
  });

  it('renders contract 1C transfer state and money', () => {
    const view = renderWorkspace('contracts', {
      ...baseDetails,
      contracts: [{
        id: 3,
        name: 'Договор поддержки',
        dateUtc: '2026-06-01T00:00:00Z',
        dateFromUtc: '2026-06-02T00:00:00Z',
        dateToUtc: '2026-06-30T00:00:00Z',
        oneCTransferState: 2,
        summa: 1500,
        isProlongation: false,
        isParus10Tornado: false,
        isOneCHourSupport: false,
        hasItsDiscount: false,
        lawNumber: 0
      }]
    });

    const text = normalizedText(view);

    expect(text).toContain('Договор поддержки');
    expect(text).toContain('1 500,00');
    expect(text).toContain('Обработано');
    expect(Array.from(view.querySelectorAll('.data-table time')).map((time) => time.getAttribute('dateTime'))).toEqual([
      '2026-06-01T00:00:00Z',
      '2026-06-02T00:00:00Z',
      '2026-06-30T00:00:00Z'
    ]);
  });

  it('renders realization date as a machine-readable time value', () => {
    const view = renderWorkspace('realizations', {
      ...baseDetails,
      realizations: [{
        id: 4,
        dateUtc: '2026-06-15T00:00:00Z',
        number: 'REAL-15',
        contractName: 'Договор внедрения',
        summa: 2500,
        isDone: true
      }]
    });

    const text = normalizedText(view);

    expect(text).toContain('REAL-15');
    expect(text).toContain('Договор внедрения');
    expect(text).toContain('2 500,00');
    expect(text).toContain('Да');
    expect(view.querySelector('.data-table time')?.getAttribute('dateTime')).toBe('2026-06-15T00:00:00Z');
  });

  it('renders Parus license dates as machine-readable time values', () => {
    const view = renderWorkspace('licenses', {
      ...baseDetails,
      parusLicenses: [{
        id: 4,
        dateSinceUtc: '2026-06-01T03:00:00Z',
        dateToUtc: '2026-06-30T03:00:00Z',
        nomenclature: 'Парус 10',
        mnemoOrg: 'ORG-1',
        regNumberClient: 'LO-42',
        number: '5'
      }]
    });

    const text = normalizedText(view);

    expect(text).toContain('Парус 10');
    expect(text).toContain('ORG-1');
    expect(Array.from(view.querySelectorAll('.data-table time')).map((time) => time.getAttribute('dateTime'))).toEqual([
      '2026-06-01T03:00:00Z',
      '2026-06-30T03:00:00Z'
    ]);
  });

  it('renders Parus order money columns', () => {
    const view = renderWorkspace('orders', {
      ...baseDetails,
      parusOrders: [{
        id: 5,
        payer: 'Провайдер',
        typeOf: 'Поставка',
        dateUtc: '2026-06-12T04:30:00Z',
        discount: 10,
        summa: 1234.5,
        customerAmount: 1400,
        invoiceNumber: 'INV-42'
      }]
    });

    const text = normalizedText(view);

    expect(text).toContain('Провайдер');
    expect(text).toContain('10,00');
    expect(text).toContain('1 234,50');
    expect(text).toContain('1 400,00');
    expect(view.querySelector('.data-table time')?.getAttribute('dateTime')).toBe('2026-06-12T04:30:00Z');
  });

  it('renders active empty state for missing details', () => {
    const view = renderWorkspace('licenses', null);

    expect(view.textContent).toContain('Лицензий Парус пока нет');
  });
});
