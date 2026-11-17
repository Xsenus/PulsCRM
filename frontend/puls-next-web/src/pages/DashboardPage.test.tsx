/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const apiMocks = vi.hoisted(() => ({
  getDashboard: vi.fn(),
  getColleagues: vi.fn(),
  user: { id: 1, login: 'ivanov', fullName: 'Иванов Иван Иванович', isRoot: false } as { id: number; login: string; fullName: string; isRoot: boolean }
}));

vi.mock('../app/api', () => ({
  getDashboard: apiMocks.getDashboard
}));

vi.mock('../app/colleagues', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../app/colleagues')>()),
  getColleagues: apiMocks.getColleagues,
  loadColleaguePhoto: vi.fn().mockResolvedValue(null)
}));

vi.mock('../app/AuthContext', () => ({
  useAuth: () => ({ user: apiMocks.user })
}));

vi.mock('../app/ChatContext', () => ({
  useOptionalChat: () => null
}));

vi.mock('../chat.css', () => ({}));

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
  apiMocks.user = { id: 1, login: 'ivanov', fullName: 'Иванов Иван Иванович', isRoot: false };
  const today = new Date();
  const inThreeDays = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3);
  apiMocks.getColleagues.mockResolvedValue([
    { id: 2, fullName: 'Петрова Анна', birthdayMonth: inThreeDays.getMonth() + 1, birthdayDay: inThreeDays.getDate(), hasPhoto: false, isMale: false },
    { id: 3, fullName: 'Сидоров Олег', birthdayMonth: null, birthdayDay: null, hasPhoto: false, isMale: true }
  ]);
  apiMocks.getDashboard.mockResolvedValue({
    employees: 7,
    organizations: 19,
    activeCampaigns: 3,
    queueDepth: 11,
    sentLast24Hours: 42,
    failedLast24Hours: 2
  });
});

afterEach(() => {
  root?.unmount();
  root = null;
  container?.remove();
  container = null;
  vi.clearAllMocks();
});

describe('DashboardPage', () => {
  it('shows an employee a personal home without mailing statistics', async () => {
    const view = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
    await flushEffects();

    expect(view.querySelector('h1')?.textContent).toMatch(/, Иван!$/);
    // Дни рождения: ближайший — через 3 дня; без даты — не показывается.
    const birthdays = view.querySelector('[aria-labelledby="home-birthdays-title"]')!;
    expect(birthdays.textContent).toContain('Петрова Анна');
    expect(birthdays.textContent).toContain('Через 3 дня');
    expect(birthdays.textContent).not.toContain('Сидоров');
    // Быстрые ссылки — только разделы сотрудника; показатели рассылок не запрашиваются.
    const links = Array.from(view.querySelectorAll('.home-links a')).map((link) => link.getAttribute('href'));
    // Сотруднику — справочник организаций только для чтения (полный раздел — администратору).
    expect(links).toEqual(['/employees', '/directory/organizations']);
    expect(view.textContent).not.toContain('Рассылки');
    expect(apiMocks.getDashboard).not.toHaveBeenCalled();
  });

  it('adds mailing statistics and admin links for an administrator', async () => {
    apiMocks.user = { ...apiMocks.user, isRoot: true };
    const view = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
    await flushEffects();

    const refreshButton = view.querySelector<HTMLButtonElement>('[aria-label="Обновить показатели рассылок"]');
    expect(refreshButton).toBeInstanceOf(HTMLButtonElement);
    expect(refreshButton?.getAttribute('title')).toBe('Обновить показатели рассылок');
    expect(view.textContent).toContain('Организации');
    expect(view.textContent).toContain('19');
    expect(view.textContent).toContain('42');
    expect(apiMocks.getDashboard).toHaveBeenCalledTimes(1);
    const links = Array.from(view.querySelectorAll('.home-links a')).map((link) => link.getAttribute('href'));
    expect(links).toEqual(['/employees', '/campaigns/new', '/campaigns', '/organizations', '/settings']);
  });
});
