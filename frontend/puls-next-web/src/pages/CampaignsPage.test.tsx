/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignsPage } from './CampaignsPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const apiMocks = vi.hoisted(() => ({
  changeCampaignStatus: vi.fn(),
  deleteCampaign: vi.fn(),
  getCampaigns: vi.fn(),
  runCampaign: vi.fn()
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
  changeCampaignStatus: apiMocks.changeCampaignStatus,
  deleteCampaign: apiMocks.deleteCampaign,
  getCampaigns: apiMocks.getCampaigns,
  runCampaign: apiMocks.runCampaign
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
  apiMocks.changeCampaignStatus.mockResolvedValue({});
  apiMocks.deleteCampaign.mockResolvedValue(undefined);
  apiMocks.getCampaigns.mockResolvedValue({
    totalCount: 1,
    items: [
      {
        id: 31,
        name: 'Недельная рассылка',
        subject: 'Новости',
        status: 1,
        scheduleKind: 0,
        timeZoneId: 'Asia/Novosibirsk',
        nextRunAtUtc: '2026-06-22T03:00:00.000Z',
        lastRunAtUtc: '2026-06-21T03:00:00.000Z',
        targetOrganizationsCount: 5,
        attachmentsCount: 2,
        transportProfileName: 'SMTP основной',
        createdAtUtc: '2026-06-10T08:30:00.000Z',
        updatedAtUtc: '2026-06-18T12:45:00.000Z'
      }
    ]
  });
  apiMocks.runCampaign.mockResolvedValue({});
  window.localStorage.setItem('puls-table-settings:campaigns-list:7', JSON.stringify({
    columns: [
      { key: 'createdAtUtc', visible: true, width: 180 },
      { key: 'updatedAtUtc', visible: true, width: 180 }
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

describe('CampaignsPage', () => {
  it('labels campaign search and status filters for assistive technology', async () => {
    const view = render(
      <MemoryRouter>
        <CampaignsPage />
      </MemoryRouter>
    );
    await flushEffects();

    const quickFilters = Array.from(view.querySelectorAll<HTMLButtonElement>('.campaign-status-filter-button'));

    expect(view.querySelector('[aria-label="Поиск рассылок по названию, теме или SMTP профилю"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="Фильтр рассылок по статусу"]')).toBeInstanceOf(HTMLSelectElement);
    expect(view.querySelector('[aria-label="Быстрый фильтр рассылок по статусу"]')).toBeInstanceOf(HTMLDivElement);
    expect(quickFilters.map((button) => button.getAttribute('aria-pressed'))).toContain('true');
    expect(quickFilters.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Все: текущий фильтр',
      'Черновик: применить фильтр',
      'Активна: применить фильтр',
      'На паузе: применить фильтр',
      'Завершена: применить фильтр',
      'Архив: применить фильтр'
    ]);
  });

  it('renders campaign list dates as machine-readable time elements', async () => {
    const view = render(
      <MemoryRouter>
        <CampaignsPage />
      </MemoryRouter>
    );
    await flushEffects();

    const tableTimes = Array.from(view.querySelectorAll<HTMLTimeElement>('table time'));

    expect(tableTimes.map((item) => item.getAttribute('dateTime'))).toEqual([
      '2026-06-22T03:00:00.000Z',
      '2026-06-21T03:00:00.000Z',
      '2026-06-10T08:30:00.000Z',
      '2026-06-18T12:45:00.000Z'
    ]);
  });
});
