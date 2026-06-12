/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import type { OrganizationDetailsDto } from '../../app/types';
import { OrganizationAuditSummary } from './OrganizationAuditSummary';

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

function makeDetails(): OrganizationDetailsDto {
  return {
    id: 1,
    name: 'Пульс',
    smallName: 'Пульс',
    fullName: 'ООО Пульс',
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
    createdAtUtc: '2026-06-12T03:10:00Z',
    createdByName: 'Администратор',
    updatedAtUtc: '2026-06-12T04:20:00Z',
    updatedByName: 'Оператор',
    updatedAdminAtUtc: '2026-06-12T05:30:00Z',
    updatedAdminByName: 'Супервизор',
    contacts: [{ id: 1, fio: 'Иван', phone: '+7', email: 'ivan@example.test' }],
    tasks: [],
    oneCSnapshots: [],
    programInfos: [{ id: 1, variant: 0, places: 3 }],
    events: [{ id: 1, eventDateUtc: '2026-06-12T00:00:00Z', isInProcess: false }],
    contracts: [
      {
        id: 1,
        oneCTransferState: 0,
        isProlongation: false,
        isParus10Tornado: false,
        isOneCHourSupport: false,
        hasItsDiscount: false,
        lawNumber: 0
      }
    ],
    attachments: [{ id: 1, fileName: 'doc.pdf', isCompleted: false }],
    realizations: [{ id: 1, isDone: false }],
    parusLicenses: [{ id: 1 }],
    parusOrders: [{ id: 1, discount: 0, summa: 0, customerAmount: 0 }]
  };
}

describe('OrganizationAuditSummary', () => {
  it('renders audit authors and entity counters', () => {
    const view = render(<OrganizationAuditSummary details={makeDetails()} emailCount={2} />);
    const cards = Array.from(view.querySelectorAll('.detail-card'));

    expect(view.textContent).toContain('Создано');
    expect(view.textContent).toContain('Администратор');
    expect(view.textContent).toContain('Оператор');
    expect(view.textContent).toContain('Супервизор');
    expect(cards).toHaveLength(9);
    expect(cards.map((card) => card.textContent)).toContain('Email-адресов2');
    expect(cards.map((card) => card.textContent)).toContain('Контактов1');
    expect(cards.map((card) => card.textContent)).toContain('Программных блоков1');
  });

  it('renders empty audit values and zero counters without details', () => {
    const view = render(<OrganizationAuditSummary details={null} emailCount={0} />);
    const values = Array.from(view.querySelectorAll('.field-hint')).map((item) => item.textContent);
    const counters = Array.from(view.querySelectorAll('.detail-card span')).map((item) => item.textContent);

    expect(values).toEqual(['-', '-', '-']);
    expect(counters).toEqual(['0', '0', '0', '0', '0', '0', '0', '0', '0']);
  });
});
