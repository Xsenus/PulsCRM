/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
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
        periods: []
      }
    ]
  };
}

beforeEach(() => {
  vi.useFakeTimers();
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
});

describe('AnalyticsPage', () => {
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

    const statusSelect = view.querySelector<HTMLSelectElement>('.analytics-groups-status');
    expect(statusSelect).toBeInstanceOf(HTMLSelectElement);

    act(() => {
      statusSelect!.value = 'lost';
      statusSelect!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flushAnalyticsLoad();

    expect(apiMocks.getParusLicenseAnalytics).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'lost',
      skip: 0,
      take: 10
    }));
  });
});
