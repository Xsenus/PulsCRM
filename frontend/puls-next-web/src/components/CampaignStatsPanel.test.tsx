/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDateTime } from '../app/format';
import type { CampaignStatisticsDto, DispatchBatchDto, DispatchItemDto } from '../app/types';
import { CampaignStatsPanel } from './CampaignStatsPanel';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function dispatchBatch(overrides: Partial<DispatchBatchDto> = {}): DispatchBatchDto {
  return {
    id: overrides.id ?? 10,
    triggerKind: overrides.triggerKind ?? 1,
    triggerComment: overrides.triggerComment,
    scheduledAtUtc: overrides.scheduledAtUtc ?? '2026-06-13T08:00:00.000Z',
    createdAtUtc: overrides.createdAtUtc ?? '2026-06-13T08:00:00.000Z',
    completedAtUtc: overrides.completedAtUtc,
    totalRecipients: overrides.totalRecipients ?? 2,
    queuedCount: overrides.queuedCount ?? 0,
    processingCount: overrides.processingCount ?? 0,
    sentCount: overrides.sentCount ?? 1,
    failedCount: overrides.failedCount ?? 1,
    cancelledCount: overrides.cancelledCount ?? 0,
    correlationId: overrides.correlationId
  };
}

function dispatchItem(overrides: Partial<DispatchItemDto> = {}): DispatchItemDto {
  return {
    id: overrides.id ?? 20,
    legacyOrgId: overrides.legacyOrgId ?? 30,
    legacyOrgName: overrides.legacyOrgName ?? 'Тестовая организация',
    recipientEmail: overrides.recipientEmail ?? 'client@example.test',
    recipientDisplayName: overrides.recipientDisplayName,
    sourceKind: overrides.sourceKind ?? 0,
    status: overrides.status ?? 2,
    attemptCount: overrides.attemptCount ?? 1,
    queuedAtUtc: overrides.queuedAtUtc ?? '2026-06-13T08:00:00.000Z',
    startedAtUtc: overrides.startedAtUtc,
    sentAtUtc: overrides.sentAtUtc,
    failedAtUtc: overrides.failedAtUtc,
    nextAttemptAtUtc: overrides.nextAttemptAtUtc,
    errorMessage: overrides.errorMessage,
    smtpResponse: overrides.smtpResponse,
    messageId: overrides.messageId
  };
}

function statistics(overrides: Partial<CampaignStatisticsDto> = {}): CampaignStatisticsDto {
  const sentItem = dispatchItem({ id: 21, recipientEmail: 'sent@example.test', status: 2, sentAtUtc: '2026-06-13T08:01:00.000Z' });
  const failedItem = dispatchItem({
    id: 22,
    recipientEmail: 'failed@example.test',
    status: 3,
    attemptCount: 2,
    failedAtUtc: '2026-06-13T08:02:00.000Z',
    nextAttemptAtUtc: '2026-06-13T08:10:00.000Z',
    smtpResponse: '550 mailbox unavailable',
    errorMessage: 'SMTP rejected recipient'
  });

  return {
    campaignId: overrides.campaignId ?? 1,
    totalItems: overrides.totalItems ?? 2,
    queued: overrides.queued ?? 0,
    processing: overrides.processing ?? 0,
    sent: overrides.sent ?? 1,
    failed: overrides.failed ?? 1,
    deferred: overrides.deferred ?? 0,
    cancelled: overrides.cancelled ?? 0,
    lastBatchScheduledAtUtc: overrides.lastBatchScheduledAtUtc,
    lastBatchCompletedAtUtc: overrides.lastBatchCompletedAtUtc,
    recentBatches: overrides.recentBatches ?? [dispatchBatch()],
    recentItems: overrides.recentItems ?? [sentItem, failedItem],
    failedItems: overrides.failedItems ?? [failedItem],
    deferredItems: overrides.deferredItems ?? []
  };
}

function render(ui: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);

  act(() => {
    root = createRoot(container!);
    root.render(ui);
  });

  return container;
}

function panel(stats: CampaignStatisticsDto | null, onRefresh = vi.fn(), onRetryItem?: (itemId: number) => Promise<void> | void) {
  return (
    <CampaignStatsPanel
      stats={stats}
      loading={false}
      onRefresh={onRefresh}
      onRetryItem={onRetryItem}
      batchesTableSettingsKey="test-campaign-batches"
      itemsTableSettingsKey="test-campaign-items"
    />
  );
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
  localStorage.clear();
});

describe('CampaignStatsPanel', () => {
  it('renders empty state before statistics are available', () => {
    const view = render(panel(null));

    expect(view.textContent).toContain('Статистика появится после сохранения и запуска кампании.');
  });

  it('renders summary, latest problem and batch list', () => {
    const view = render(panel(statistics()));

    expect(view.textContent).toContain('Всего записей');
    expect(view.textContent).toContain('SMTP rejected recipient');
    expect(view.textContent).toContain('failed@example.test');
    expect(view.textContent).toContain('2 попытки');
    expect(view.textContent).toContain(`Следующая попытка: ${formatDateTime('2026-06-13T08:10:00.000Z')}`);
    expect(view.textContent).toContain('SMTP: 550 mailbox unavailable');
    expect(view.textContent).toContain('Пакет #10');
  });

  it('filters recent items by failed status', () => {
    const view = render(panel(statistics()));
    const tablist = view.querySelector('.campaign-dispatch-filters[role="tablist"]');
    const filters = Array.from(tablist?.querySelectorAll<HTMLButtonElement>('.settings-tab') ?? []);
    const failedFilter = filters.find((button) => button.textContent === 'Ошибки');

    expect(tablist?.getAttribute('aria-label')).toBe('Фильтр сообщений очереди');
    expect(filters.map((filter) => filter.getAttribute('role'))).toEqual(['tab', 'tab', 'tab', 'tab', 'tab', 'tab']);
    expect(filters.map((filter) => filter.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false', 'false', 'false']);
    expect(view.textContent).toContain('sent@example.test');
    expect(view.textContent).toContain('failed@example.test');

    act(() => {
      failedFilter?.click();
    });

    expect(filters.map((filter) => filter.getAttribute('aria-selected'))).toEqual(['false', 'false', 'false', 'false', 'true', 'false']);
    expect(view.textContent).not.toContain('sent@example.test');
    expect(view.textContent).toContain('failed@example.test');
  });

  it('retries failed items from the problem list', async () => {
    const onRetryItem = vi.fn(async () => {});
    const view = render(panel(statistics(), vi.fn(), onRetryItem));
    const retryButton = Array.from(view.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Повторить');

    await act(async () => {
      retryButton?.click();
    });

    expect(onRetryItem).toHaveBeenCalledWith(22);
  });

  it('keeps retry action disabled while retry is pending', async () => {
    let resolveRetry: () => void = () => {};
    const retryPromise = new Promise<void>((resolve) => {
      resolveRetry = resolve;
    });
    const onRetryItem = vi.fn(() => retryPromise);
    const view = render(panel(statistics(), vi.fn(), onRetryItem));
    const retryButton = Array.from(view.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Повторить')!;

    act(() => {
      retryButton.click();
    });

    expect(onRetryItem).toHaveBeenCalledTimes(1);
    expect(retryButton.disabled).toBe(true);
    expect(retryButton.textContent).toContain('Возвращаем');

    await act(async () => {
      resolveRetry();
      await retryPromise;
    });

    expect(retryButton.disabled).toBe(false);
    expect(retryButton.textContent).toContain('Повторить');
  });
});
