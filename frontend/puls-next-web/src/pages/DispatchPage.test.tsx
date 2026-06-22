/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DispatchPage } from './DispatchPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const apiMocks = vi.hoisted(() => ({
  cancelDispatchItem: vi.fn(),
  getDispatchBatches: vi.fn(),
  getDispatchItems: vi.fn(),
  retryDispatchItem: vi.fn()
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
  cancelDispatchItem: apiMocks.cancelDispatchItem,
  getDispatchBatches: apiMocks.getDispatchBatches,
  getDispatchItems: apiMocks.getDispatchItems,
  retryDispatchItem: apiMocks.retryDispatchItem
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

function click(element: Element) {
  act(() => {
    Simulate.click(element);
  });
}

beforeEach(() => {
  apiMocks.cancelDispatchItem.mockResolvedValue({});
  apiMocks.getDispatchItems.mockResolvedValue({
    totalCount: 1,
    items: [
      {
        id: 101,
        legacyOrgId: 9001,
        legacyOrgName: 'ООО Тест',
        recipientEmail: 'client@example.test',
        recipientDisplayName: 'Client',
        sourceKind: 1,
        status: 3,
        attemptCount: 2,
        queuedAtUtc: '2026-06-20T05:00:00.000Z',
        failedAtUtc: '2026-06-20T05:15:00.000Z',
        nextAttemptAtUtc: '2026-06-20T06:15:00.000Z',
        errorMessage: 'SMTP timeout'
      }
    ]
  });
  apiMocks.getDispatchBatches.mockResolvedValue({
    totalCount: 1,
    items: [
      {
        id: 77,
        triggerKind: 0,
        scheduledAtUtc: '2026-06-20T04:45:00.000Z',
        createdAtUtc: '2026-06-20T04:50:00.000Z',
        completedAtUtc: '2026-06-20T05:20:00.000Z',
        totalRecipients: 1,
        queuedCount: 0,
        processingCount: 0,
        sentCount: 0,
        failedCount: 1,
        cancelledCount: 0,
        correlationId: 'dispatch-test'
      }
    ]
  });
  apiMocks.retryDispatchItem.mockResolvedValue({});
});

afterEach(() => {
  root?.unmount();
  root = null;
  container?.remove();
  container = null;
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('DispatchPage', () => {
  it('exposes queue summary and filters with accessible labels', async () => {
    const view = render(<DispatchPage />);
    await flushEffects();

    const summary = view.querySelector('[aria-label="Сводка сообщений очереди на текущей странице"]');
    expect(summary?.getAttribute('role')).toBe('list');
    expect(summary?.querySelectorAll('[role="listitem"]')).toHaveLength(4);
    expect(summary?.textContent).toContain('Ошибки на странице');

    expect(view.querySelector('[aria-label="Фильтр очереди по статусу сообщения"]')).toBeInstanceOf(HTMLSelectElement);
    expect(view.querySelector('[aria-label="Фильтр очереди по ID кампании"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="Фильтр очереди по ID партии"]')).toBeInstanceOf(HTMLInputElement);
  });

  it('renders queue and batch dates as machine-readable time elements', async () => {
    const view = render(<DispatchPage />);
    await flushEffects();

    const itemTimes = Array.from(view.querySelectorAll<HTMLTimeElement>('table time'));

    expect(itemTimes.map((item) => item.getAttribute('dateTime'))).toEqual([
      '2026-06-20T05:15:00.000Z',
      '2026-06-20T06:15:00.000Z'
    ]);

    const tabs = Array.from(view.querySelectorAll<HTMLButtonElement>('.dispatch-tabs [role="tab"]'));
    const batchTab = tabs.find((button) => button.textContent?.includes('Партии'));
    expect(batchTab).not.toBeNull();
    expect(tabs.map((button) => button.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(tabs.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Сообщения: текущий раздел',
      'Партии: открыть раздел'
    ]);

    click(batchTab!);
    await flushEffects();

    expect(tabs.map((button) => button.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    expect(tabs.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Сообщения: открыть раздел',
      'Партии: текущий раздел'
    ]);

    const batchTimes = Array.from(view.querySelectorAll<HTMLTimeElement>('table time'));

    expect(batchTimes.map((item) => item.getAttribute('dateTime'))).toEqual([
      '2026-06-20T04:45:00.000Z',
      '2026-06-20T04:50:00.000Z',
      '2026-06-20T05:20:00.000Z'
    ]);
  });
});
