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
  siteComment: 'Комментарий по сайту'
};

describe('OrganizationSiteDetails', () => {
  it('renders site details, normalized links and status', () => {
    const view = render(<OrganizationSiteDetails details={details} licenseStatus={licenseStatus} />);

    expect(view.querySelector('h4')?.textContent).toBe('Сайт');
    expect(Array.from(view.querySelectorAll('.detail-card'))).toHaveLength(14);
    expect(view.querySelector('a[href=\"https://example.test\"]')?.textContent).toBe('example.test');
    expect(view.querySelector('a[href=\"tel:+79130000000\"]')?.textContent).toBe('+7 913 000-00-00');
    expect(view.querySelector('a[href=\"mailto:site@example.test\"]')?.textContent).toBe('site@example.test');
    expect(view.textContent).toContain('Домен делегирован');
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
