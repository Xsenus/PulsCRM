/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import type { OrganizationLicenseStatusView } from './OrganizationOneCDetails';
import { OrganizationSiteDetails, type OrganizationSiteDetailsData } from './OrganizationSiteDetails';

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
  tone: 'ok',
  label: 'Домен делегирован',
  hint: 'запас 120 дн.'
};

const details: OrganizationSiteDetailsData = {
  site: 'example.test',
  siteAlias: 'crm',
  siteContactName: 'Анна Сайтова',
  siteContactPhone: '+7 913 000-00-00',
  siteEmail: 'site@example.test',
  siteState: 'Работает',
  siteOnSupport: false,
  siteTemplate: 'Основной',
  siteBaseId: 0,
  siteReadyAtUtc: '2026-06-12T03:10:00Z',
  siteLicenseDateFromUtc: '2026-06-01T00:00:00Z',
  siteLicenseDateToUtc: '2026-06-30T00:00:00Z',
  siteComment: 'Комментарий по сайту'
};

describe('OrganizationSiteDetails', () => {
  it('renders site details, normalized links and status', () => {
    const view = render(<OrganizationSiteDetails details={details} licenseStatus={licenseStatus} />);
    const lists = Array.from(view.querySelectorAll('[role="list"]'));

    expect(view.querySelector('h4')?.textContent).toBe('Сайт');
    expect(lists.map((list) => list.getAttribute('aria-label'))).toEqual([
      'Параметры сайта организации',
      'Комментарии по сайту организации'
    ]);
    expect(lists[0].querySelectorAll('[role="listitem"]')).toHaveLength(14);
    expect(lists[1].querySelectorAll('[role="listitem"]')).toHaveLength(1);
    expect(Array.from(view.querySelectorAll('.detail-card'))).toHaveLength(14);
    expect(view.querySelector('a[href=\"https://example.test\"]')?.textContent).toBe('example.test');
    expect(view.querySelector('a[href=\"tel:+79130000000\"]')?.textContent).toBe('+7 913 000-00-00');
    expect(view.querySelector('a[href=\"mailto:site@example.test\"]')?.textContent).toBe('site@example.test');
    expect(view.textContent).toContain('Домен делегирован');
    expect(view.querySelector('.organization-status-pill')?.getAttribute('role')).toBe('status');
    expect(Array.from(view.querySelectorAll('time')).map((time) => time.getAttribute('dateTime'))).toEqual([
      '2026-06-12T03:10:00Z',
      '2026-06-01T00:00:00Z',
      '2026-06-30T00:00:00Z'
    ]);
    expect(view.textContent).toContain('Нет');
    expect(view.textContent).toContain('0');
    expect(view.textContent).toContain('Комментарий по сайту');
  });

  it('renders fallbacks when details are missing', () => {
    const view = render(<OrganizationSiteDetails details={null} licenseStatus={licenseStatus} />);

    expect(Array.from(view.querySelectorAll('.detail-card'))).toHaveLength(14);
    expect(view.textContent).toContain('Домен делегирован');
    expect(view.querySelector('.detail-list .field-hint')?.textContent).toBe('-');
  });
});
