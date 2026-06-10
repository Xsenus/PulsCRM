export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 75, 100];

export function normalizePageSizeValue(value: unknown, defaultPageSize = DEFAULT_PAGE_SIZE) {
  const parsedValue = typeof value === 'number' ? value : Number(value);
  return PAGE_SIZE_OPTIONS.includes(parsedValue) ? parsedValue : defaultPageSize;
}

export function loadStoredPageSize(storageKey: string, defaultPageSize = DEFAULT_PAGE_SIZE, ...fallbackStorageKeys: string[]) {
  if (typeof window === 'undefined') {
    return defaultPageSize;
  }

  for (const currentKey of [storageKey, ...fallbackStorageKeys]) {
    const rawValue = window.localStorage.getItem(currentKey);
    const parsedValue = normalizePageSizeValue(rawValue, NaN);

    if (!Number.isNaN(parsedValue)) {
      return parsedValue;
    }
  }

  return defaultPageSize;
}
