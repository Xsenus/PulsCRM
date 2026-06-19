/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { OrganizationLegacyNotes, type OrganizationLegacyNotesData } from './OrganizationLegacyNotes';

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

const details: OrganizationLegacyNotesData = {
  additionalComment: 'Особые условия сопровождения',
  technicsComment: 'Есть удаленный доступ',
  procurementComment: 'Закупка через конкурс'
};

describe('OrganizationLegacyNotes', () => {
  it('renders legacy note labels and values', () => {
    const view = render(<OrganizationLegacyNotes details={details} />);
    const labels = Array.from(view.querySelectorAll('strong')).map((item) => item.textContent);
    const values = Array.from(view.querySelectorAll('.field-hint')).map((item) => item.textContent);
    const list = view.querySelector('[role="list"]');

    expect(view.querySelector('h4')?.textContent).toBe('Legacy-заметки');
    expect(list?.getAttribute('aria-label')).toBe('Legacy-заметки организации');
    expect(list?.querySelectorAll('[role="listitem"]')).toHaveLength(3);
    expect(labels).toEqual(['Дополнительный комментарий', 'Техника', 'Закупки']);
    expect(values).toEqual(['Особые условия сопровождения', 'Есть удаленный доступ', 'Закупка через конкурс']);
  });

  it('renders fallback values when notes are missing', () => {
    const view = render(<OrganizationLegacyNotes details={null} />);
    const values = Array.from(view.querySelectorAll('.field-hint')).map((item) => item.textContent);

    expect(values).toEqual(['-', '-', '-']);
  });

  it('trims whitespace-only values to fallback', () => {
    const view = render(<OrganizationLegacyNotes details={{ additionalComment: '  ', technicsComment: '\t', procurementComment: '\n' }} />);
    const values = Array.from(view.querySelectorAll('.field-hint')).map((item) => item.textContent);

    expect(values).toEqual(['-', '-', '-']);
  });
});
