import type { DispatchBatchListQuery, DispatchItemDto, DispatchItemListQuery } from './types';

export type DispatchStatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export const dispatchStatusOptions: Array<{ value: number; label: string; tone: DispatchStatusTone }> = [
  { value: 0, label: 'В очереди', tone: 'info' },
  { value: 1, label: 'В работе', tone: 'warning' },
  { value: 2, label: 'Отправлено', tone: 'success' },
  { value: 3, label: 'Ошибка', tone: 'danger' },
  { value: 4, label: 'Отменено', tone: 'neutral' },
  { value: 5, label: 'Отложено', tone: 'warning' }
];

export interface DispatchItemsSummary {
  queued: number;
  processing: number;
  failed: number;
  deferred: number;
  latestProblemItem: DispatchItemDto | null;
}

export function getDispatchStatusLabel(status: number) {
  return dispatchStatusOptions.find((option) => option.value === status)?.label ?? `Статус ${status}`;
}

export function getDispatchStatusTone(status: number): DispatchStatusTone {
  return dispatchStatusOptions.find((option) => option.value === status)?.tone ?? 'neutral';
}

export function canRetryDispatchItem(item: Pick<DispatchItemDto, 'status'>) {
  return item.status === 3 || item.status === 5;
}

export function canCancelDispatchItem(item: Pick<DispatchItemDto, 'status'>) {
  return item.status !== 2 && item.status !== 4;
}

function isDispatchProblemItem(item: Pick<DispatchItemDto, 'status'>) {
  return item.status === 3 || item.status === 5;
}

function getDispatchProblemSortDate(item: DispatchItemDto) {
  return item.failedAtUtc || item.nextAttemptAtUtc || item.queuedAtUtc || '';
}

export function findLatestDispatchProblemItem(items: DispatchItemDto[]) {
  let latest: DispatchItemDto | null = null;

  for (const item of items) {
    if (!isDispatchProblemItem(item)) {
      continue;
    }

    if (!latest || getDispatchProblemSortDate(item).localeCompare(getDispatchProblemSortDate(latest)) > 0) {
      latest = item;
    }
  }

  return latest;
}

export function buildDispatchItemsSummary(items: DispatchItemDto[]): DispatchItemsSummary {
  const summary: DispatchItemsSummary = {
    queued: 0,
    processing: 0,
    failed: 0,
    deferred: 0,
    latestProblemItem: null
  };

  for (const item of items) {
    if (item.status === 0) {
      summary.queued += 1;
    } else if (item.status === 1) {
      summary.processing += 1;
    } else if (item.status === 3) {
      summary.failed += 1;
    } else if (item.status === 5) {
      summary.deferred += 1;
    }

    if (
      isDispatchProblemItem(item)
      && (!summary.latestProblemItem || getDispatchProblemSortDate(item).localeCompare(getDispatchProblemSortDate(summary.latestProblemItem)) > 0)
    ) {
      summary.latestProblemItem = item;
    }
  }

  return summary;
}

export function buildDispatchItemQuery(filters: {
  status?: number;
  campaignId?: number;
  batchId?: number;
  search?: string;
}, skip: number, take: number): DispatchItemListQuery {
  return {
    status: filters.status,
    campaignId: filters.campaignId,
    batchId: filters.batchId,
    search: filters.search?.trim() || undefined,
    skip: Math.max(0, skip),
    take
  };
}

export function buildDispatchBatchQuery(filters: {
  campaignId?: number;
}, skip: number, take: number): DispatchBatchListQuery {
  return {
    campaignId: filters.campaignId,
    skip: Math.max(0, skip),
    take
  };
}
