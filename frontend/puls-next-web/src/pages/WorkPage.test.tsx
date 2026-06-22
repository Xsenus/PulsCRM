/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkPage } from './WorkPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const apiMocks = vi.hoisted(() => ({
  getEmployees: vi.fn(),
  getOrganizations: vi.fn(),
  getWork: vi.fn()
}));

vi.mock('../app/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 7,
      login: 'tester',
      fullName: 'Тестовый пользователь',
      isRoot: true
    },
    loading: false,
    isAuthenticated: true,
    login: async () => undefined,
    logout: () => undefined
  })
}));

vi.mock('../app/api', () => ({
  getEmployees: apiMocks.getEmployees,
  getOrganizations: apiMocks.getOrganizations,
  getWork: apiMocks.getWork
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

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  apiMocks.getEmployees.mockResolvedValue({ totalCount: 0, items: [] });
  apiMocks.getOrganizations.mockResolvedValue({ totalCount: 0, items: [] });
  apiMocks.getWork.mockResolvedValue({
    totalCount: 1,
    items: [
      {
        id: 501,
        userFromId: 1,
        userFromName: 'Иван',
        userToId: 2,
        userToName: 'Ольга',
        orgId: 10,
        orgName: 'ООО Тест',
        category: 'Поддержка',
        task: 'Проверить отправку',
        message: 'Нужно проверить задачу',
        comment: 'Готово',
        createdAtUtc: '2026-06-12T04:30:00.000Z',
        dateToUtc: '2026-06-15T09:00:00.000Z',
        dateCompletedUtc: '2026-06-16T10:15:00.000Z',
        isCompleted: true
      }
    ]
  });
  window.localStorage.setItem('puls-table-settings:work-list:7', JSON.stringify({
    columns: [
      { key: 'dateCompletedUtc', visible: true, width: 180 }
    ]
  }));
});

afterEach(() => {
  root?.unmount();
  root = null;
  container?.remove();
  container = null;
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('WorkPage', () => {
  it('renders work dates as machine-readable time elements', async () => {
    const view = render(<WorkPage />);
    await flushEffects();

    const workSearch = view.querySelector<HTMLInputElement>('[aria-label="Поиск задач по сообщению, задаче, сотруднику или организации"]');
    const organizationFilter = view.querySelector<HTMLSelectElement>('[aria-label="Фильтр задач по организации"]');
    const employeeFilter = view.querySelector<HTMLSelectElement>('[aria-label="Фильтр задач по сотруднику"]');
    const tableTimes = Array.from(view.querySelectorAll<HTMLTimeElement>('table time'));

    expect(workSearch).toBeInstanceOf(HTMLInputElement);
    expect(organizationFilter).toBeInstanceOf(HTMLSelectElement);
    expect(employeeFilter).toBeInstanceOf(HTMLSelectElement);
    expect(tableTimes.map((item) => item.getAttribute('dateTime'))).toEqual([
      '2026-06-12T04:30:00.000Z',
      '2026-06-15T09:00:00.000Z',
      '2026-06-16T10:15:00.000Z'
    ]);
  });
});
