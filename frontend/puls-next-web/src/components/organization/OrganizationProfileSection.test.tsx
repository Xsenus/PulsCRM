/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OrganizationDetailsDto, OrganizationEditorLookupsDto, OrganizationUpsertRequest } from '../../app/types';
import { OrganizationProfileSection } from './OrganizationProfileSection';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const draft: OrganizationUpsertRequest = {
  name: 'Пульс',
  smallName: 'Пульс CRM',
  fullName: 'Муниципальное учреждение Пульс',
  inn: '5400000000',
  ogrn: '1025400000000',
  kpp: '540001001',
  raionId: 7,
  orgTypeId: 3,
  visible: true,
  isManager: false,
  comment: 'Рабочий комментарий',
  otherInfo: 'Дополнительная информация',
  phone: '+7 (383) 100-00-00',
  primaryEmail: 'main@example.test',
  site: 'https://example.test',
  salaryEnabled: false,
  oneCAccountingEnabled: false,
  oneCSalaryEnabled: false,
  oneCHousingEnabled: false
};

const lookups: OrganizationEditorLookupsDto = {
  raions: [{ id: 7, name: 'Центральный район' }],
  orgTypes: [{ id: 3, name: 'Учреждение' }]
};

const details = {
  directorFullName: 'Иванов Иван Иванович',
  directorPosition: 'Директор',
  directorPhone: '+7 (383) 200-00-00',
  directorEmail: 'director@example.test',
  additionalComment: 'Особые условия сопровождения',
  technicsComment: 'Есть удаленный доступ',
  procurementComment: 'Закупка через конкурс'
} as OrganizationDetailsDto;

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

describe('OrganizationProfileSection', () => {
  it('renders main form, contacts, director details and legacy notes', () => {
    const view = render(
      <OrganizationProfileSection
        details={details}
        draft={draft}
        lookups={lookups}
        disabled={false}
        onDraftChange={vi.fn()}
      />
    );

    expect(view.textContent).toContain('Основные реквизиты');
    expect(view.textContent).toContain('Контактные данные');
    expect(view.textContent).toContain('Руководитель и служебные реквизиты');
    expect(view.textContent).toContain('Legacy-заметки');
    expect((view.querySelector('#org-name') as HTMLInputElement | null)?.value).toBe('Пульс');
    expect((view.querySelector('#org-raion') as HTMLSelectElement | null)?.value).toBe('7');
    expect((view.querySelector('#org-type') as HTMLSelectElement | null)?.value).toBe('3');
    expect((view.querySelector('#org-phone') as HTMLInputElement | null)?.value).toBe('+7 (383) 100-00-00');
    expect((view.querySelector('#org-primary-email') as HTMLInputElement | null)?.value).toBe('main@example.test');
    expect(view.textContent).toContain('Иванов Иван Иванович');
    expect(view.textContent).toContain('Особые условия сопровождения');
  });

  it('passes form changes to parent draft handler', () => {
    const handleDraftChange = vi.fn();
    const view = render(
      <OrganizationProfileSection
        details={null}
        draft={draft}
        lookups={lookups}
        disabled={false}
        onDraftChange={handleDraftChange}
      />
    );

    act(() => {
      (view.querySelector('#org-raion') as HTMLSelectElement).value = '';
      view.querySelector('#org-raion')?.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(handleDraftChange).toHaveBeenCalledWith(expect.objectContaining({ raionId: undefined }));
  });
});
