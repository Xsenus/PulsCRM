/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsPage } from './AnalyticsPage';
import type { ParusLicenseAnalyticsDto } from '../app/types';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const apiMocks = vi.hoisted(() => ({
  downloadParusLicenseFile: vi.fn(),
  getParusLicenseAnalytics: vi.fn()
}));

vi.mock('../app/api', () => ({
  downloadParusLicenseFile: apiMocks.downloadParusLicenseFile,
  getParusLicenseAnalytics: apiMocks.getParusLicenseAnalytics
}));

vi.mock('../app/toast', () => ({
  showToast: vi.fn()
}));

vi.mock('../app/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 7, login: 'tester', fullName: 'Tester', isRoot: true },
    loading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn()
  })
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

async function flushAnalyticsLoad() {
  await act(async () => {
    vi.advanceTimersByTime(300);
    await Promise.resolve();
    await Promise.resolve();
  });
}

function buildAnalytics(): ParusLicenseAnalyticsDto {
  const year = new Date().getFullYear();
  const from = `${year}-01-01T00:00:00Z`;
  const to = `${year}-12-31T00:00:00Z`;

  return {
    dateFromUtc: from,
    dateToUtc: to,
    summary: {
      licenseGroups: 1,
      licenseRecords: 1,
      clients: 1,
      activeAtPeriodEnd: 0,
      expiredAtPeriodEnd: 1,
      renewed: 0,
      withoutRenewal: 1,
      expiringInPeriod: 1,
      newLicenses: 0,
      lost: 1
    },
    periods: [
      {
        year,
        dateFromUtc: from,
        dateToUtc: to,
        licenseGroups: 1,
        licenseRecords: 1,
        clients: 1,
        activeAtPeriodEnd: 0,
        expiredAtPeriodEnd: 1,
        renewed: 0,
        withoutRenewal: 1,
        expiringInPeriod: 1,
        newLicenses: 0,
        lost: 1
      }
    ],
    products: [],
    groups: [],
    organizationGroupsTotalCount: 1,
    organizationGroups: [
      {
        key: '1:HA2360',
        clientId: 1,
        clientName: 'Client',
        inn: '5400000000',
        mnemoOrg: 'Client',
        licenseNumber: 'HA2360',
        databaseCount: 1,
        organizationCount: 0,
        extraWorkplaces: 0,
        periodsCount: 1,
        componentsCount: 1,
        activeAtPeriodEnd: false,
        expiredAtPeriodEnd: true,
        renewedInPeriod: false,
        withoutRenewal: true,
        expiringInPeriod: true,
        newInPeriod: false,
        lostInPeriod: true,
        periods: [
          {
            key: '1:HA2360:20260101:20261231',
            licenseNumber: 'HA2360',
            dateSinceUtc: from,
            dateToUtc: to,
            componentsCount: 1,
            activeAtPeriodEnd: false,
            expiredAtPeriodEnd: true,
            hasLicenseFile: false,
            components: [
              {
                id: 11,
                number: '1',
                quantity: '5',
                product: 'Парус',
                modification: 'Торнадо',
                nomenclature: 'Рабочее место'
              }
            ]
          }
        ]
      }
    ]
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  apiMocks.getParusLicenseAnalytics.mockResolvedValue(buildAnalytics());
  apiMocks.downloadParusLicenseFile.mockResolvedValue(new Blob());
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  container?.remove();
  container = null;
  vi.useRealTimers();
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe('AnalyticsPage', () => {
  it('keeps annual analytics disabled by default and persists user preference', async () => {
    const view = render(<AnalyticsPage />);
    await flushAnalyticsLoad();

    const checkbox = view.querySelector<HTMLInputElement>('.analytics-annual-toggle input[type="checkbox"]');
    expect(checkbox).toBeInstanceOf(HTMLInputElement);
    expect(checkbox!.checked).toBe(false);
    expect(view.querySelector('.analytics-year-table')).toBeNull();

    act(() => {
      checkbox!.checked = true;
      Simulate.change(checkbox!);
    });

    expect(window.localStorage.getItem('puls-analytics:parus-annual-analytics:7')).toBe('1');

    act(() => {
      root?.unmount();
    });
    root = null;
    container?.remove();
    container = null;

    const nextView = render(<AnalyticsPage />);
    await flushAnalyticsLoad();

    const nextCheckbox = nextView.querySelector<HTMLInputElement>('.analytics-annual-toggle input[type="checkbox"]');
    expect(nextCheckbox?.checked).toBe(true);
    expect(nextView.querySelector('.analytics-year-table')).toBeInstanceOf(HTMLTableElement);
  });

  it('requests server-side license groups with selected status filter', async () => {
    const view = render(<AnalyticsPage />);
    await flushAnalyticsLoad();

    const currentYear = new Date().getFullYear();
    expect(apiMocks.getParusLicenseAnalytics).toHaveBeenLastCalledWith(expect.objectContaining({
      dateFromUtc: `${currentYear}-01-01T00:00:00.000Z`,
      dateToUtc: `${currentYear}-12-31T00:00:00.000Z`,
      status: 'all',
      skip: 0,
      take: 10
    }));

    const statusButton = view.querySelector<HTMLButtonElement>('.analytics-groups-status');
    expect(statusButton).toBeInstanceOf(HTMLButtonElement);

    act(() => {
      Simulate.click(statusButton!);
    });

    const lostOption = view.querySelector<HTMLButtonElement>('.analytics-combobox-option[data-value="lost"]');
    expect(lostOption).toBeInstanceOf(HTMLButtonElement);

    act(() => {
      Simulate.click(lostOption!);
    });
    await flushAnalyticsLoad();

    expect(apiMocks.getParusLicenseAnalytics).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'lost',
      skip: 0,
      take: 10
    }));
  });

  it('restores selected period and saves it after generation', async () => {
    window.localStorage.setItem('puls-analytics:parus-period:7', JSON.stringify({
      from: '2025-02-01',
      to: '2025-03-31'
    }));

    const view = render(<AnalyticsPage />);
    await flushAnalyticsLoad();

    expect(apiMocks.getParusLicenseAnalytics).toHaveBeenLastCalledWith(expect.objectContaining({
      dateFromUtc: '2025-02-01T00:00:00.000Z',
      dateToUtc: '2025-03-31T00:00:00.000Z'
    }));

    const fromInput = view.querySelector<HTMLInputElement>('#analytics-date-from');
    const toInput = view.querySelector<HTMLInputElement>('#analytics-date-to');
    const applyButton = Array.from(view.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Сформировать'));

    expect(fromInput).toBeInstanceOf(HTMLInputElement);
    expect(toInput).toBeInstanceOf(HTMLInputElement);
    expect(applyButton).toBeInstanceOf(HTMLButtonElement);

    act(() => {
      fromInput!.value = '01.04.2025';
      Simulate.change(fromInput!);
      toInput!.value = '30.04.2025';
      Simulate.change(toInput!);
    });

    act(() => {
      Simulate.click(applyButton!);
    });
    await flushAnalyticsLoad();

    expect(window.localStorage.getItem('puls-analytics:parus-period:7')).toBe(JSON.stringify({
      from: '2025-04-01',
      to: '2025-04-30'
    }));
    expect(apiMocks.getParusLicenseAnalytics).toHaveBeenLastCalledWith(expect.objectContaining({
      dateFromUtc: '2025-04-01T00:00:00.000Z',
      dateToUtc: '2025-04-30T00:00:00.000Z'
    }));
  });

  it('exports a valid XLSX workbook with organization and print sheets', async () => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    let exportedBlob: Blob | null = null;

    URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
      exportedBlob = blob as Blob;
      return 'blob:analytics-export';
    });
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    try {
      const view = render(<AnalyticsPage />);
      await flushAnalyticsLoad();

      const exportButton = view.querySelector<HTMLButtonElement>('[aria-label="Выгрузить отчет по группам лицензий в Excel"]');
      expect(exportButton).toBeInstanceOf(HTMLButtonElement);

      await act(async () => {
        Simulate.click(exportButton!);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(clickSpy).toHaveBeenCalled();
      expect(exportedBlob).toBeInstanceOf(Blob);
      expect(exportedBlob?.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      const workbookBuffer = new Uint8Array(await exportedBlob!.arrayBuffer());
      expect(workbookBuffer[0]).toBe(0x50);
      expect(workbookBuffer[1]).toBe(0x4b);

      const workbook = new TextDecoder().decode(workbookBuffer);
      expect(workbook).toContain('[Content_Types].xml');
      expect(workbook).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml');
      expect(workbook).toContain('xl/workbook.xml');
      expect(workbook).toContain('xl/worksheets/sheet1.xml');
      expect(workbook).toContain('xl/worksheets/sheet2.xml');
      expect(workbook).toContain('Организации');
      expect(workbook).toContain('Печать по заказам');
      expect(workbook).toContain('Client');
      expect(workbook).toContain('Рабочее место');
      expect(workbook).toContain('Торнадо');
    } finally {
      URL.createObjectURL = originalCreateObjectUrl;
      URL.revokeObjectURL = originalRevokeObjectUrl;
      clickSpy.mockRestore();
    }
  });
});
