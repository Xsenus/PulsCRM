/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { OrganizationOneCDetails, type OrganizationLicenseStatusView, type OrganizationOneCDetailsData } from './OrganizationOneCDetails';

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

const licenseStatus: OrganizationLicenseStatusView = {
  tone: 'warn',
  label: 'Срок скоро закончится',
  hint: 'осталось 10 дн.'
};

const details: OrganizationOneCDetailsData = {
  oneCContactName: 'Иван Иванов',
  oneCContactPhone: '+7 (383) 111-22-33',
  oneCEmail: 'onec@example.test',
  oneCAccountingEnabled: true,
  oneCSalaryEnabled: false,
  oneCHousingEnabled: true,
  oneCLeadAccountingName: 'Главный бух',
  oneCLeadSalaryName: 'Главный ЗП',
  oneCBaseContract: false,
  oneCRegNumberAccounting: 'ACC-42',
  oneCRegNumberSalary: 'SAL-42',
  oneCPlatformAccounting: '8.3',
  oneCPlatformSalary: '8.4',
  oneCConfigurationAccounting: 'Бухгалтерия',
  oneCConfigurationSalary: 'Зарплата',
  oneCContractVariant: 'Базовый',
  oneCItsVariant: 'ПРОФ',
  oneCItsLicenseNumber: 'ITS-42',
  oneCItsCompleted: false,
  oneCItsAmount: 0,
  oneCItsAmountComment: 'Нулевая сумма',
  oneCComment: 'Комментарий бухгалтерии',
  oneCSalaryComment: 'Комментарий зарплаты',
  oneCAccountingChanges: 'Доработки бух',
  oneCSalaryChanges: 'Доработки ЗП',
  oneCItsComment: 'Комментарий ИТС',
  oneCItsComposition: 'Состав ИТС'
};

describe('OrganizationOneCDetails', () => {
  it('renders 1C details, links and license status', () => {
    const view = render(<OrganizationOneCDetails details={details} licenseStatus={licenseStatus} />);
    const cards = Array.from(view.querySelectorAll('.detail-card'));

    expect(view.querySelector('h4')?.textContent).toBe('1С');
    expect(cards).toHaveLength(24);
    expect(view.textContent).toContain('Иван Иванов');
    expect(view.textContent).toContain('Срок скоро закончится');
    expect(view.textContent).toContain('осталось 10 дн.');
    expect(view.textContent).toContain('0,00');
    expect(view.textContent).toContain('Комментарий ИТС');
    expect(view.querySelector('a[href=\"tel:+73831112233\"]')?.textContent).toBe('+7 (383) 111-22-33');
    expect(view.querySelector('a[href=\"mailto:onec@example.test\"]')?.textContent).toBe('onec@example.test');
  });

  it('keeps false booleans and zero amount visible', () => {
    const view = render(<OrganizationOneCDetails details={details} licenseStatus={licenseStatus} />);

    expect(view.textContent).toContain('Нет');
    expect(view.textContent).toContain('0,00');
  });

  it('renders fallbacks when details are missing', () => {
    const view = render(<OrganizationOneCDetails details={null} licenseStatus={licenseStatus} />);

    expect(Array.from(view.querySelectorAll('.detail-card'))).toHaveLength(24);
    expect(view.textContent).toContain('Срок скоро закончится');
    expect(Array.from(view.querySelectorAll('.detail-list .field-hint')).map((item) => item.textContent)).toEqual(['-', '-', '-', '-', '-', '-']);
  });
});
