import type { DispatchItemDto } from './types';

export type DispatchStatusFilter = 'all' | 'queued' | 'processing' | 'sent' | 'failed' | 'cancelled' | 'deferred';

const statusByFilter: Record<Exclude<DispatchStatusFilter, 'all'>, number> = {
  queued: 0,
  processing: 1,
  sent: 2,
  failed: 3,
  cancelled: 4,
  deferred: 5
};

export function filterDispatchItems(items: DispatchItemDto[], filter: DispatchStatusFilter): DispatchItemDto[] {
  if (filter === 'all') {
    return items;
  }

  return items.filter((item) => item.status === statusByFilter[filter]);
}

export function findLatestProblemItem(failedItems: DispatchItemDto[], deferredItems: DispatchItemDto[]): DispatchItemDto | null {
  const problemItems = [...failedItems, ...deferredItems];
  if (problemItems.length === 0) {
    return null;
  }

  return problemItems.sort((left, right) => {
    const leftDate = left.failedAtUtc || left.nextAttemptAtUtc || left.queuedAtUtc || '';
    const rightDate = right.failedAtUtc || right.nextAttemptAtUtc || right.queuedAtUtc || '';
    return rightDate.localeCompare(leftDate);
  })[0];
}

export function buildProblemItems(failedItems: DispatchItemDto[], deferredItems: DispatchItemDto[], limit = 8): DispatchItemDto[] {
  return [...failedItems, ...deferredItems]
    .sort((left, right) => {
      const leftDate = left.failedAtUtc || left.nextAttemptAtUtc || left.queuedAtUtc || '';
      const rightDate = right.failedAtUtc || right.nextAttemptAtUtc || right.queuedAtUtc || '';
      return rightDate.localeCompare(leftDate);
    })
    .slice(0, limit);
}

export function formatAttemptCount(value?: number | null): string {
  const count = Math.max(0, value ?? 0);
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${count} попыток`;
  }

  if (lastDigit === 1) {
    return `${count} попытка`;
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${count} попытки`;
  }

  return `${count} попыток`;
}
