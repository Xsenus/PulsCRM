/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { OrganizationSalaryDetails, type OrganizationSalaryDetailsData } from './OrganizationSalaryDetails';

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

const details: OrganizationSalaryDetailsData = {
  salaryEnabled: true,
  salaryLabel: 'Основная',
  salaryContactPhone: '+7 (383) 200-00-00',
  salaryEmail: ' salary@example.test ',
  salaryLeadName: 'Куратор ЗП',
  salaryLicenseNumber: 'LO-42',
  salaryManualLicenseNumber: 'MAN-42',
  salaryLicenseOrganizationName: 'ООО Пульс',
  salaryLicenseFileName: 'license.lic',
  salaryPlatform: '8.3',
  salaryConfiguration: 'Зарплата',
  salaryRating: 'A',
  salaryDatabaseCount: 2,
  salaryOrganizationCount: 5,
  salaryExtraWorkplaces: 1,
  salaryWorkBeginUtc: '2026-06-12T03:10:00Z',
  salaryWorkEndUtc: '2026-06-13T03:10:00Z',
  salaryLicenseComposition: 'Базовый пакет',
  salaryComment: 'Работает стабильно'
};

describe('OrganizationSalaryDetails', () => {
  it('renders salary fields, contact links and comments', () => {
    const view = render(<OrganizationSalaryDetails details={details} />);
    const lists = Array.from(view.querySelectorAll('[role="list"]'));

    expect(view.querySelector('h4')?.textContent).toBe('Зарплата');
    expect(lists.map((list) => list.getAttribute('aria-label'))).toEqual([
      'Зарплатное сопровождение организации',
      'Комментарии зарплатного сопровождения'
    ]);
    expect(lists[0].querySelectorAll('[role="listitem"]')).toHaveLength(17);
    expect(lists[1].querySelectorAll('[role="listitem"]')).toHaveLength(2);
    expect(view.querySelectorAll('.detail-card')).toHaveLength(17);
    expect(view.textContent).toContain('Да');
    expect(view.textContent).toContain('LO-42');
    expect(view.textContent).toContain('Базовый пакет');
    expect(view.textContent).toContain('Работает стабильно');
    expect(Array.from(view.querySelectorAll('time')).map((time) => time.getAttribute('dateTime'))).toEqual([
      '2026-06-12T03:10:00Z',
      '2026-06-13T03:10:00Z'
    ]);
    expect(view.querySelector('a[href="tel:+73832000000"]')?.textContent).toBe('+7 (383) 200-00-00');
    expect(view.querySelector('a[href="mailto:salary@example.test"]')?.textContent).toBe('salary@example.test');
  });

  it('renders fallback values when details are missing', () => {
    const view = render(<OrganizationSalaryDetails details={null} />);
    const cardValues = Array.from(view.querySelectorAll('.detail-card span')).map((item) => item.textContent);
    const noteValues = Array.from(view.querySelectorAll('.field-hint')).map((item) => item.textContent);

    expect(cardValues).toEqual(['-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-']);
    expect(noteValues).toEqual(['-', '-']);
  });

  it('renders false boolean and zero counters as explicit values', () => {
    const view = render(
      <OrganizationSalaryDetails
        details={{ salaryEnabled: false, salaryDatabaseCount: 0, salaryOrganizationCount: 0, salaryExtraWorkplaces: 0 }}
      />
    );
    const cardValues = Array.from(view.querySelectorAll('.detail-card span')).map((item) => item.textContent);

    expect(cardValues[0]).toBe('Нет');
    expect(cardValues[12]).toBe('0');
    expect(cardValues[13]).toBe('0');
    expect(cardValues[14]).toBe('0');
  });
});
