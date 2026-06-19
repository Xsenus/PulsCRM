/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { OrganizationBankDetails, type OrganizationBankDetailsData } from './OrganizationBankDetails';

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

const details: OrganizationBankDetailsData = {
  okved: '62.01',
  okpo: '12345678',
  pfrNumber: '064-000-000000',
  fssNumber: '5400000000',
  bankName: 'ПАО Тест Банк',
  bankBik: '045004000',
  bankCity: 'Новосибирск',
  bankAccount: '40702810000000000001',
  personalAccount: '123.45.678.9',
  bankCorrespondentAccount: '30101810000000000000',
  pfrAgreementNumber: 'ПФР-42',
  pfrAgreementDateUtc: '2026-06-12T03:10:00Z',
  ecpComment: 'Сертификат действует',
  ecpContractComment: 'Включить в договор'
};

describe('OrganizationBankDetails', () => {
  it('renders bank requisites and ECP comments', () => {
    const view = render(<OrganizationBankDetails details={details} />);
    const cards = Array.from(view.querySelectorAll('.detail-card'));
    const lists = Array.from(view.querySelectorAll('[role="list"]'));

    expect(view.querySelector('h4')?.textContent).toBe('ЭЦП и банковские реквизиты');
    expect(lists.map((list) => list.getAttribute('aria-label'))).toEqual([
      'Банковские реквизиты организации',
      'Комментарии ЭЦП организации'
    ]);
    expect(lists[0].querySelectorAll('[role="listitem"]')).toHaveLength(12);
    expect(lists[1].querySelectorAll('[role="listitem"]')).toHaveLength(2);
    expect(cards).toHaveLength(12);
    expect(view.textContent).toContain('62.01');
    expect(view.textContent).toContain('ПАО Тест Банк');
    expect(view.textContent).toContain('ПФР-42');
    expect(view.textContent).toContain('Сертификат действует');
    expect(view.textContent).toContain('Включить в договор');
  });

  it('renders fallback values when details are missing', () => {
    const view = render(<OrganizationBankDetails details={null} />);
    const cardValues = Array.from(view.querySelectorAll('.detail-card span')).map((item) => item.textContent);
    const noteValues = Array.from(view.querySelectorAll('.field-hint')).map((item) => item.textContent);

    expect(cardValues).toEqual(['-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-']);
    expect(noteValues).toEqual(['-', '-']);
  });

  it('trims blank string values to fallback', () => {
    const view = render(<OrganizationBankDetails details={{ bankName: '  ', ecpComment: '\t' }} />);

    expect(view.querySelector('.detail-card-wide span')?.textContent).toBe('-');
    expect(view.querySelector('.field-hint')?.textContent).toBe('-');
  });
});
