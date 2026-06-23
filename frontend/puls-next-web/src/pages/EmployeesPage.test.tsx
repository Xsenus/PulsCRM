/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeesPage } from './EmployeesPage';
import type { EmployeeListItemDto } from '../app/types';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const apiMocks = vi.hoisted(() => ({
  deleteEmployee: vi.fn(),
  getEmployees: vi.fn()
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
  deleteEmployee: apiMocks.deleteEmployee,
  getEmployees: apiMocks.getEmployees
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

function employee(overrides: Partial<EmployeeListItemDto>): EmployeeListItemDto {
  return {
    id: overrides.id ?? 1,
    login: overrides.login ?? 'tester',
    fullName: overrides.fullName ?? 'Тестовый сотрудник',
    isRoot: false,
    isMale: true,
    isDismissed: false,
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
  apiMocks.deleteEmployee.mockResolvedValue(undefined);
  apiMocks.getEmployees.mockResolvedValue({
    totalCount: 1,
    items: [
      employee({
        id: 11,
        login: 'ivanov',
        fullName: 'Иванов Иван',
        email: 'ivanov@example.test',
        phone: '+7 999 000-00-00'
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

describe('EmployeesPage', () => {
  it('labels employee search and loads the employee list', async () => {
    const view = render(
      <MemoryRouter>
        <EmployeesPage />
      </MemoryRouter>
    );
    await flushEffects();

    expect(view.querySelector('[aria-label="Поиск сотрудников по логину, ФИО, email или телефону"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.textContent).toContain('Иванов Иван');
    expect(apiMocks.getEmployees).toHaveBeenLastCalledWith('', 0, 25);
  });

  it('adds employee context to desktop row action menu labels', async () => {
    const view = render(
      <MemoryRouter>
        <EmployeesPage />
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

    expect(menu?.getAttribute('aria-label')).toBe('Действия сотрудника Иванов Иван');
    expect(menu?.querySelector('[aria-label="Создать нового сотрудника"]')).toBeInstanceOf(HTMLButtonElement);
    expect(menu?.querySelector('[aria-label="Редактировать сотрудника Иванов Иван"]')).toBeInstanceOf(HTMLButtonElement);
    expect(menu?.querySelector('[aria-label="Обновить список после проверки сотрудника Иванов Иван"]')).toBeInstanceOf(HTMLButtonElement);
    expect(menu?.querySelector('[aria-label="Удалить сотрудника Иванов Иван"]')).toBeInstanceOf(HTMLButtonElement);
  });
});
