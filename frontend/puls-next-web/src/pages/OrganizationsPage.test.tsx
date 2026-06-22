/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationsPage } from './OrganizationsPage';
import type { OrganizationListItemDto } from '../app/types';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const apiMocks = vi.hoisted(() => ({
  deleteOrganization: vi.fn(),
  getOrganizationRaions: vi.fn(),
  getOrganizations: vi.fn()
}));

vi.mock('../app/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 7,
      login: 'tester',
      fullName: 'Тестовый пользователь',
      isRoot: true
    }
  })
}));

vi.mock('../app/api', () => ({
  deleteOrganization: apiMocks.deleteOrganization,
  getOrganizationRaions: apiMocks.getOrganizationRaions,
  getOrganizations: apiMocks.getOrganizations
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

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  apiMocks.deleteOrganization.mockResolvedValue(undefined);
  apiMocks.getOrganizationRaions.mockResolvedValue([
    { id: 10, name: 'Центральный', count: 4 },
    { id: 20, name: 'Северный', count: 2 }
  ]);
  apiMocks.getOrganizations.mockResolvedValue({
    totalCount: 1,
    items: [
      organization({
        id: 1,
        name: 'Первая организация',
        inn: '5400000000',
        raion: 'Центральный',
        orgType: 'Бюджетная',
        emailCount: 2,
        contactCount: 1
      })
    ]
  });
});

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }

  root = null;
  container?.remove();
  container = null;
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('OrganizationsPage', () => {
  it('labels the raion search and applies selected raions through the API filter', async () => {
    const view = render(
      <MemoryRouter>
        <OrganizationsPage />
      </MemoryRouter>
    );
    await flushEffects();

    const raionSearch = view.querySelector<HTMLInputElement>('[aria-label="Поиск района организации"]');
    const filterStatus = view.querySelector('[aria-label="Активные фильтры организаций"]');
    const centralRaion = Array.from(view.querySelectorAll<HTMLLabelElement>('.raion-checkbox-card'))
      .find((label) => label.textContent?.includes('Центральный'));
    const centralCheckbox = centralRaion?.querySelector<HTMLInputElement>('input[type="checkbox"]');

    expect(raionSearch).toBeInstanceOf(HTMLInputElement);
    expect(filterStatus?.getAttribute('role')).toBe('status');
    expect(filterStatus?.textContent).toContain('Показаны все организации');
    expect(centralCheckbox?.checked).toBe(false);

    await act(async () => {
      centralCheckbox?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      centralCheckbox?.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flushEffects();

    expect(centralCheckbox?.checked).toBe(true);
    expect(apiMocks.getOrganizations).toHaveBeenLastCalledWith({
      search: '',
      raionIds: [10],
      skip: 0,
      take: 25
    });
    expect(filterStatus?.textContent).toContain('Центральный');
  });

  it('adds organization context to desktop row action menu labels', async () => {
    const view = render(
      <MemoryRouter>
        <OrganizationsPage />
      </MemoryRouter>
    );
    await flushEffects();

    const row = view.querySelector<HTMLTableRowElement>('tbody tr');

    await act(async () => {
      row?.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        clientX: 120,
        clientY: 160
      }));
    });

    const menu = view.querySelector('[role="menu"]');

    expect(menu?.getAttribute('aria-label')).toBe('Действия организации Первая организация');
    expect(menu?.querySelector('[aria-label="Создать новую организацию"]')).toBeInstanceOf(HTMLButtonElement);
    expect(menu?.querySelector('[aria-label="Редактировать организацию Первая организация"]')).toBeInstanceOf(HTMLButtonElement);
    expect(menu?.querySelector('[aria-label="Обновить список после проверки организации Первая организация"]')).toBeInstanceOf(HTMLButtonElement);
    expect(menu?.querySelector('[aria-label="Удалить организацию Первая организация"]')).toBeInstanceOf(HTMLButtonElement);
  });
});
