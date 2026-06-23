/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OrganizationUpsertRequest } from '../app/types';
import { OrganizationEditorForm } from './OrganizationEditorForm';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const organizationValue: OrganizationUpsertRequest = {
  name: 'Тестовая организация',
  visible: true,
  isManager: false,
  salaryEnabled: true,
  oneCAccountingEnabled: false,
  oneCSalaryEnabled: true,
  oneCHousingEnabled: false
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

describe('OrganizationEditorForm', () => {
  it('labels main section flag toggles for assistive technologies', () => {
    const view = render(
      <OrganizationEditorForm
        value={organizationValue}
        lookups={{ raions: [], orgTypes: [] }}
        section="main"
        onChange={vi.fn()}
      />
    );

    expect(view.querySelector('[aria-label="Название организации"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="Краткое название организации"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="Полное название организации"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="ИНН организации"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="ОГРН организации"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="КПП организации"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="Район организации"]')).toBeInstanceOf(HTMLSelectElement);
    expect(view.querySelector('[aria-label="Тип организации"]')).toBeInstanceOf(HTMLSelectElement);
    expect(view.querySelector('[aria-label="Запись организации видима"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="Организация доступна менеджеру"]')).toBeInstanceOf(HTMLInputElement);
  });

  it('labels programs section flag toggles for assistive technologies', () => {
    const view = render(
      <OrganizationEditorForm
        value={organizationValue}
        lookups={null}
        section="programs"
        onChange={vi.fn()}
      />
    );

    expect(view.querySelector('[aria-label="Подключена зарплата организации"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="Подключена 1C бухгалтерия организации"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="Подключена 1C зарплата организации"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="Подключена 1C ЖКХ организации"]')).toBeInstanceOf(HTMLInputElement);
  });
});
