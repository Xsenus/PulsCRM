import { describe, expect, it } from 'vitest';
import {
  buildDispatchBatchQuery,
  buildDispatchItemQuery,
  canCancelDispatchItem,
  canRetryDispatchItem,
  getDispatchStatusLabel,
  getDispatchStatusTone
} from './dispatchDiagnostics';

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
