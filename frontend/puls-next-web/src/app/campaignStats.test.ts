import { describe, expect, it } from 'vitest';
import { buildCampaignProblemSummary, buildProblemItems, filterDispatchItems, findLatestProblemItem, formatAttemptCount } from './campaignStats';
import type { DispatchItemDto } from './types';

function item(patch: Partial<DispatchItemDto>): DispatchItemDto {
  return {
    id: patch.id ?? 1,
    legacyOrgId: 0,
    sourceKind: 0,
    status: patch.status ?? 0,
    attemptCount: 0,
    ...patch
  };
}

describe('campaign stats helpers', () => {
  it('filters dispatch items by status', () => {
    const items = [item({ id: 1, status: 0 }), item({ id: 2, status: 3 }), item({ id: 3, status: 5 })];

    expect(filterDispatchItems(items, 'all').map((value) => value.id)).toEqual([1, 2, 3]);
    expect(filterDispatchItems(items, 'failed').map((value) => value.id)).toEqual([2]);
    expect(filterDispatchItems(items, 'deferred').map((value) => value.id)).toEqual([3]);
  });

  it('finds latest failed or deferred item', () => {
    const latest = findLatestProblemItem(
      [item({ id: 1, status: 3, failedAtUtc: '2026-06-10T08:00:00.000Z' })],
      [item({ id: 2, status: 5, nextAttemptAtUtc: '2026-06-10T09:00:00.000Z' })]
    );

    expect(latest?.id).toBe(2);
  });

  it('builds limited problem list ordered by latest date', () => {
    const result = buildProblemItems(
      [
        item({ id: 1, status: 3, failedAtUtc: '2026-06-10T08:00:00.000Z' }),
        item({ id: 2, status: 3, failedAtUtc: '2026-06-10T10:00:00.000Z' })
      ],
      [item({ id: 3, status: 5, nextAttemptAtUtc: '2026-06-10T09:00:00.000Z' })],
      2
    );

    expect(result.map((value) => value.id)).toEqual([2, 3]);
  });

  it('builds campaign problem summary without full source reorder', () => {
    const failedItems = [
      item({ id: 1, status: 3, failedAtUtc: '2026-06-10T08:00:00.000Z' }),
      item({ id: 2, status: 3, failedAtUtc: '2026-06-10T10:00:00.000Z' })
    ];
    const deferredItems = [
      item({ id: 3, status: 5, nextAttemptAtUtc: '2026-06-10T09:00:00.000Z' }),
      item({ id: 4, status: 5, nextAttemptAtUtc: '2026-06-10T07:00:00.000Z' })
    ];

    const summary = buildCampaignProblemSummary(failedItems, deferredItems, 3);

    expect(summary.latestProblemItem?.id).toBe(2);
    expect(summary.problemItems.map((value) => value.id)).toEqual([2, 3, 1]);
    expect(failedItems.map((value) => value.id)).toEqual([1, 2]);
    expect(deferredItems.map((value) => value.id)).toEqual([3, 4]);
    expect(buildCampaignProblemSummary(failedItems, deferredItems, 0)).toEqual({
      latestProblemItem: failedItems[1],
      problemItems: []
    });
  });

  it('formats attempt count with Russian plural forms', () => {
    expect(formatAttemptCount(0)).toBe('0 попыток');
    expect(formatAttemptCount(1)).toBe('1 попытка');
    expect(formatAttemptCount(2)).toBe('2 попытки');
    expect(formatAttemptCount(5)).toBe('5 попыток');
    expect(formatAttemptCount(11)).toBe('11 попыток');
    expect(formatAttemptCount(21)).toBe('21 попытка');
    expect(formatAttemptCount(null)).toBe('0 попыток');
  });
});
