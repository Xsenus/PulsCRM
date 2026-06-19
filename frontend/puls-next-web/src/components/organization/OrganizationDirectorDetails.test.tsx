/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { OrganizationDirectorDetails, type OrganizationDirectorDetailsData } from './OrganizationDirectorDetails';

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

const details: OrganizationDirectorDetailsData = {
  directorFullName: 'Иванов Иван Иванович',
  directorShortName: 'Иванов И.И.',
  directorGenitiveName: 'Иванова Ивана Ивановича',
  directorPosition: 'Директор',
  directorPositionGenitive: 'Директора',
  authorityDocument: 'Устав',
  directorPhone: '+7 (383) 200-00-00',
  directorEmail: 'director@example.test',
  directorSnils: '123-456-789 00'
};

describe('OrganizationDirectorDetails', () => {
  it('renders director fields and contact links', () => {
    const view = render(<OrganizationDirectorDetails details={details} />);
    const list = view.querySelector('[role="list"]');

    expect(view.querySelector('h4')?.textContent).toBe('Руководитель и служебные реквизиты');
    expect(list?.getAttribute('aria-label')).toBe('Реквизиты руководителя организации');
    expect(list?.querySelectorAll('[role="listitem"]')).toHaveLength(9);
    expect(view.querySelectorAll('.detail-card')).toHaveLength(9);
    expect(view.textContent).toContain('Иванов Иван Иванович');
    expect(view.textContent).toContain('Устав');
    expect(view.querySelector('a[href="tel:+73832000000"]')?.textContent).toBe('+7 (383) 200-00-00');
    expect(view.querySelector('a[href="mailto:director@example.test"]')?.textContent).toBe('director@example.test');
  });

  it('renders fallback values when director details are missing', () => {
    const view = render(<OrganizationDirectorDetails details={null} />);
    const values = Array.from(view.querySelectorAll('.detail-card span')).map((item) => item.textContent);

    expect(values).toEqual(['-', '-', '-', '-', '-', '-', '-', '-', '-']);
  });

  it('trims email before rendering mailto link', () => {
    const view = render(<OrganizationDirectorDetails details={{ directorEmail: '  boss@example.test  ' }} />);

    expect(view.querySelector('a[href="mailto:boss@example.test"]')?.textContent).toBe('boss@example.test');
  });
});
