/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OrganizationDetailsDto, OrganizationUpsertRequest } from '../../app/types';
import { OrganizationSupportSection } from './OrganizationSupportSection';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const draft: OrganizationUpsertRequest = {
  name: 'Пульс',
  visible: true,
  isManager: false,
  salaryEnabled: true,
  oneCAccountingEnabled: true,
  oneCSalaryEnabled: false,
  oneCHousingEnabled: false
};

function makeDetails(overrides: Partial<OrganizationDetailsDto> = {}): OrganizationDetailsDto {
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
    salaryEnabled: true,
    salaryLeadName: 'Расчетчик',
    salaryLicenseNumber: 'SAL-1',
    oneCAccountingEnabled: true,
    oneCSalaryEnabled: false,
    oneCHousingEnabled: false,
    salaryDatabaseCount: 0,
    salaryOrganizationCount: 0,
    salaryExtraWorkplaces: 0,
    oneCBaseContract: false,
    oneCItsDateFromUtc: '2026-01-01T00:00:00Z',
    oneCItsDateToUtc: '2099-01-01T00:00:00Z',
    oneCItsCompleted: false,
    siteOnSupport: false,
    siteLicenseDateFromUtc: '2026-01-01T00:00:00Z',
    siteLicenseDateToUtc: '2000-01-01T00:00:00Z',
    siteLicenseCompleted: false,
    bankName: 'Банк Пульс',
    pfrAgreementNumber: 'PFR-42',
    contacts: [],
    tasks: [],
    oneCSnapshots: [],
    programInfos: [{ id: 1, variant: 0, places: 3, fullName: 'Бухгалтерия' }],
    events: [],
    contracts: [],
    attachments: [],
    realizations: [],
    parusLicenses: [],
    parusOrders: [],
    ...overrides
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

function renderSection(details: OrganizationDetailsDto | null = makeDetails()) {
  return render(
    <OrganizationSupportSection
      details={details}
      draft={draft}
      lookups={{ raions: [], orgTypes: [] }}
      disabled={false}
      onDraftChange={vi.fn()}
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

describe('OrganizationSupportSection', () => {
  it('renders support summary and all support detail blocks', () => {
    const view = renderSection();

    expect(view.querySelectorAll('.organization-support-summary-card')).toHaveLength(4);
    expect(view.textContent).toContain('Банк Пульс');
    expect(view.textContent).toContain('Соглашение ПФР №PFR-42');
    expect(view.textContent).toContain('Расчетчик');
    expect(view.textContent).toContain('ЛО SAL-1');
    expect(view.textContent).toContain('Лицензия актуальна');
    expect(view.textContent).toContain('Срок делегирования домена истек');
    expect(view.textContent).toContain('Продукты и сопровождение');
    expect(view.textContent).toContain('ЭЦП и банковские реквизиты');
    expect(view.textContent).toContain('Зарплата');
    expect(view.textContent).toContain('1С');
    expect(view.textContent).toContain('Сайт');
    expect(view.textContent).toContain('Блоки программ');
    expect(Array.from(view.querySelectorAll('.organization-support-summary-card .field-hint time')).map((time) => time.getAttribute('dateTime'))).toEqual([
      '2026-01-01T00:00:00Z',
      '2099-01-01T00:00:00Z',
      '2026-01-01T00:00:00Z',
      '2000-01-01T00:00:00Z'
    ]);
    expect(Array.from(view.querySelectorAll('.panel-subsection .detail-card .field-hint time')).map((time) => time.getAttribute('dateTime'))).toEqual([
      '2026-01-01T00:00:00Z',
      '2099-01-01T00:00:00Z',
      '2026-01-01T00:00:00Z',
      '2000-01-01T00:00:00Z'
    ]);
  });

  it('renders muted summary cards and empty child blocks without saved details', () => {
    const view = renderSection(null);

    expect(view.querySelectorAll('.organization-support-summary-card')).toHaveLength(4);
    expect(view.textContent).toContain('Реквизиты не заполнены');
    expect(view.textContent).toContain('Не используется');
    expect(view.textContent).toContain('Данные не заполнены');
    expect(view.textContent).toContain('0 записей');
  });
});
