import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PAGE_SIZE, loadStoredPageSize, normalizePageSizeValue } from './table';

describe('table page size helpers', () => {
  it('accepts only supported page sizes', () => {
    expect(normalizePageSizeValue(10)).toBe(10);
    expect(normalizePageSizeValue('50')).toBe(50);
    expect(normalizePageSizeValue(12)).toBe(DEFAULT_PAGE_SIZE);
    expect(normalizePageSizeValue('abc', 75)).toBe(75);
  });

  it('loads first valid value from primary and fallback keys', () => {
    const storage = new Map<string, string>([
      ['primary', '12'],
      ['legacy', '75']
    ]);

    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null
      }
    });

    try {
      expect(loadStoredPageSize('primary', DEFAULT_PAGE_SIZE, 'legacy')).toBe(75);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('returns provided default when browser storage is unavailable', () => {
    vi.stubGlobal('window', undefined);

    try {
      expect(loadStoredPageSize('missing', 50)).toBe(50);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
