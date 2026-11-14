import { describe, expect, it } from 'vitest';
import { createTaskLimiter } from './taskLimiter';

describe('createTaskLimiter', () => {
  it('runs at most N tasks at once, in order, and passes results and errors through', async () => {
    const schedule = createTaskLimiter(3);
    let running = 0;
    let peak = 0;
    const started: number[] = [];
    const task = (id: number, fail = false) => async () => {
      started.push(id);
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      if (fail) {
        throw new Error(`fail ${id}`);
      }

      return id;
    };

    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, index) => schedule(task(index + 1, index === 4))));
    expect(peak).toBe(3);
    expect(started).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(results[0]).toEqual({ status: 'fulfilled', value: 1 });
    expect(results[4]).toMatchObject({ status: 'rejected', reason: new Error('fail 5') });
    expect(results[9]).toEqual({ status: 'fulfilled', value: 10 });
  });
});
