import { describe, expect, it } from 'vitest';
import {
  buildDispatchBatchQuery,
  buildDispatchItemQuery,
  canCancelDispatchItem,
  canRetryDispatchItem,
  findLatestDispatchProblemItem,
  getDispatchStatusLabel,
  getDispatchStatusTone
} from './dispatchDiagnostics';
import type { DispatchItemDto } from './types';

function dispatchItem(overrides: Partial<DispatchItemDto>): DispatchItemDto {
  return {
    id: overrides.id ?? 1,
    legacyOrgId: overrides.legacyOrgId ?? 100,
    sourceKind: overrides.sourceKind ?? 1,
    status: overrides.status ?? 0,
    attemptCount: overrides.attemptCount ?? 0,
    ...overrides
  };
}

describe('dispatch diagnostics helpers', () => {
  it('maps dispatch statuses to operator labels and tones', () => {
    expect(getDispatchStatusLabel(3)).toBe('Ошибка');
    expect(getDispatchStatusTone(2)).toBe('success');
    expect(getDispatchStatusLabel(99)).toBe('Статус 99');
    expect(getDispatchStatusTone(99)).toBe('neutral');
  });

  it('allows retry only for failed and deferred items', () => {
    expect(canRetryDispatchItem({ status: 3 })).toBe(true);
    expect(canRetryDispatchItem({ status: 5 })).toBe(true);
    expect(canRetryDispatchItem({ status: 0 })).toBe(false);
    expect(canRetryDispatchItem({ status: 2 })).toBe(false);
  });

  it('does not allow cancelling sent or already cancelled items', () => {
    expect(canCancelDispatchItem({ status: 0 })).toBe(true);
    expect(canCancelDispatchItem({ status: 1 })).toBe(true);
    expect(canCancelDispatchItem({ status: 3 })).toBe(true);
    expect(canCancelDispatchItem({ status: 2 })).toBe(false);
    expect(canCancelDispatchItem({ status: 4 })).toBe(false);
  });

  it('finds the latest failed or deferred dispatch item for operator diagnostics', () => {
    const latest = findLatestDispatchProblemItem([
      dispatchItem({ id: 10, status: 2, sentAtUtc: '2026-06-20T08:00:00.000Z' }),
      dispatchItem({ id: 11, status: 5, nextAttemptAtUtc: '2026-06-20T06:30:00.000Z' }),
      dispatchItem({ id: 12, status: 3, failedAtUtc: '2026-06-20T07:15:00.000Z' })
    ]);

    expect(latest?.id).toBe(12);
    expect(findLatestDispatchProblemItem([dispatchItem({ id: 13, status: 2 })])).toBeNull();
  });

  it('builds normalized item and batch queries', () => {
    expect(buildDispatchItemQuery({ status: 3, campaignId: 10, batchId: 20, search: '  fail  ' }, -25, 50)).toEqual({
      status: 3,
      campaignId: 10,
      batchId: 20,
      search: 'fail',
      skip: 0,
      take: 50
    });

    expect(buildDispatchBatchQuery({ campaignId: 10 }, -1, 25)).toEqual({
      campaignId: 10,
      skip: 0,
      take: 25
    });
  });
});
