import type { DispatchItemDto } from './types';

export type DispatchStatusFilter = 'all' | 'queued' | 'processing' | 'sent' | 'failed' | 'cancelled' | 'deferred';

export interface CampaignProblemSummary {
  latestProblemItem: DispatchItemDto | null;
  problemItems: DispatchItemDto[];
}

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

function getProblemItemSortDate(item: DispatchItemDto) {
  return item.failedAtUtc || item.nextAttemptAtUtc || item.queuedAtUtc || '';
}

function compareProblemItems(left: DispatchItemDto, right: DispatchItemDto) {
  return getProblemItemSortDate(right).localeCompare(getProblemItemSortDate(left));
}

export function buildCampaignProblemSummary(failedItems: DispatchItemDto[], deferredItems: DispatchItemDto[], limit = 8): CampaignProblemSummary {
  const problemItems: DispatchItemDto[] = [];
  const maxItems = Math.max(0, limit);
  let latestProblemItem: DispatchItemDto | null = null;

  const visitItem = (item: DispatchItemDto) => {
    if (!latestProblemItem || compareProblemItems(item, latestProblemItem) < 0) {
      latestProblemItem = item;
    }

    if (maxItems === 0) {
      return;
    }

    const insertAt = problemItems.findIndex((existing) => compareProblemItems(item, existing) < 0);
    if (insertAt === -1) {
      problemItems.push(item);
    } else {
      problemItems.splice(insertAt, 0, item);
    }

    if (problemItems.length > maxItems) {
      problemItems.pop();
    }
  };

  failedItems.forEach(visitItem);
  deferredItems.forEach(visitItem);

  return {
    latestProblemItem,
    problemItems
  };
}

export function findLatestProblemItem(failedItems: DispatchItemDto[], deferredItems: DispatchItemDto[]): DispatchItemDto | null {
  return buildCampaignProblemSummary(failedItems, deferredItems, 0).latestProblemItem;
}

export function buildProblemItems(failedItems: DispatchItemDto[], deferredItems: DispatchItemDto[], limit = 8): DispatchItemDto[] {
  return buildCampaignProblemSummary(failedItems, deferredItems, limit).problemItems;
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
