/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationPicker } from './OrganizationPicker';
import type { OrganizationListItemDto } from '../app/types';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const apiMocks = vi.hoisted(() => ({
  getOrganizations: vi.fn(),
  getOrganizationRaions: vi.fn()
}));

vi.mock('../app/api', () => apiMocks);

vi.mock('../app/AuthContext', () => ({
  useAuth: () => ({ user: { id: 7 } })
}));

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

function organization(overrides: Partial<OrganizationListItemDto>): OrganizationListItemDto {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Организация',
    visible: true,
    isManager: false,
    emails: overrides.emails ?? [],
    emailCount: overrides.emailCount ?? 0,
    contactCount: overrides.contactCount ?? 0,
    openWorkItems: 0,
    ...overrides
  };
}

async function flushAsyncUpdates() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  apiMocks.getOrganizations.mockResolvedValue({
    items: [
      organization({ id: 1, name: 'Первая организация', emailCount: 2, contactCount: 3 }),
      organization({ id: 3, name: 'Новая организация', emailCount: 1, contactCount: 1 })
    ],
    totalCount: 2
  });
  apiMocks.getOrganizationRaions.mockResolvedValue([
    { id: 10, name: 'Центральный', count: 4 },
    { id: 20, name: 'Северный', count: 2 }
  ]);
});

afterEach(() => {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
  }

  root = null;
  container?.remove();
  container = null;
  vi.clearAllMocks();
});

describe('OrganizationPicker', () => {
  it('renders selected recipient organization summary', () => {
    const view = render(
      <OrganizationPicker
        value={[
          organization({ id: 1, name: 'Первая организация', emailCount: 2, contactCount: 3 }),
          organization({ id: 2, name: 'Вторая организация', emailCount: 0, contactCount: 1 })
        ]}
        onChange={vi.fn()}
      />
    );

    const summary = view.querySelector('.organization-recipient-summary');

    expect(summary?.getAttribute('role')).toBe('list');
    expect(summary?.getAttribute('aria-label')).toBe('Сводка выбранных организаций');
    expect(summary?.querySelectorAll('[role="listitem"]')).toHaveLength(5);
    expect(summary?.textContent).toContain('Организаций2');
    expect(summary?.textContent).toContain('Известных email2');
    expect(summary?.textContent).toContain('С email1');
    expect(summary?.textContent).toContain('Без email1');
    expect(summary?.textContent).toContain('Контактов4');
    expect(view.textContent).toContain('Первая организация');
    expect(view.textContent).toContain('Вторая организация');
    expect(view.querySelector('[role="status"]')?.textContent).toContain('Без email: 1');

    const selectedList = view.querySelector('[aria-label="Выбранные организации для рассылки"]');
    expect(selectedList?.getAttribute('role')).toBe('list');
    expect(selectedList?.querySelectorAll('[role="listitem"]')).toHaveLength(2);
    expect(selectedList?.querySelector('.status-badge-warning')?.textContent).toBe('Нет email');
    expect(view.querySelector('[aria-label="Убрать организацию Первая организация из получателей"]')).toBeInstanceOf(HTMLButtonElement);
  });

  it('keeps empty selected organizations state outside the accessible list', () => {
    const view = render(<OrganizationPicker value={[]} onChange={vi.fn()} />);

    expect(view.textContent).toContain('Организации пока не выбраны.');
    expect(view.querySelector('[aria-label="Выбранные организации для рассылки"]')).toBeNull();

    const summary = view.querySelector('[aria-label="Сводка выбранных организаций"]');
    expect(summary?.getAttribute('role')).toBe('list');
    expect(summary?.querySelectorAll('[role="listitem"]')).toHaveLength(5);
    expect(view.querySelector('[role="status"]')).toBeNull();
  });

  it('labels modal draft selection checkboxes with organization names and actions', async () => {
    const view = render(
      <OrganizationPicker
        value={[organization({ id: 1, name: 'Первая организация', emailCount: 2, contactCount: 3 })]}
        onChange={vi.fn()}
      />
    );

    const openButton = Array.from(view.querySelectorAll('button')).find((button) => button.textContent === 'Открыть справочник');

    await act(async () => {
      openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushAsyncUpdates();

    expect(apiMocks.getOrganizations).toHaveBeenCalled();
    expect(document.body.querySelector('[aria-label="Поиск организаций для рассылки по названию, ИНН, району или типу"]')).toBeInstanceOf(HTMLInputElement);
    const selectionStatus = document.body.querySelector('.modal-actions-note');
    expect(selectionStatus?.getAttribute('role')).toBe('status');
    expect(selectionStatus?.getAttribute('aria-live')).toBe('polite');
    expect(selectionStatus?.getAttribute('aria-label')).toBe('Выбрано организаций: 1');
    expect(document.body.querySelector('[aria-label="Убрать организацию Первая организация из черновика получателей"]')).toBeInstanceOf(HTMLInputElement);
    const allRaionsButton = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.raion-link')).find((button) => button.textContent?.includes('Все'));
    const centralRaionButton = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.raion-link')).find((button) => button.textContent?.includes('Центральный'));
    expect(allRaionsButton?.getAttribute('aria-pressed')).toBe('true');
    expect(centralRaionButton?.getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      centralRaionButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.querySelector<HTMLButtonElement>('.raion-link')?.getAttribute('aria-pressed')).toBe('false');
    expect(centralRaionButton?.getAttribute('aria-pressed')).toBe('true');

    const newOrganizationCheckbox = document.body.querySelector<HTMLInputElement>('[aria-label="Добавить организацию Новая организация в черновик получателей"]');
    expect(newOrganizationCheckbox).toBeInstanceOf(HTMLInputElement);
    const newOrganizationDraftControls = Array.from(document.body.querySelectorAll('[aria-label="Добавить организацию Новая организация в черновик получателей"]'));
    expect(newOrganizationDraftControls.some((element) => element instanceof HTMLButtonElement)).toBe(true);

    await act(async () => {
      newOrganizationCheckbox?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      newOrganizationCheckbox?.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(document.body.querySelector('.modal-actions-note')?.getAttribute('aria-label')).toBe('Выбрано организаций: 2');
  });
});
