export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 75, 100];

export function loadStoredPageSize(storageKey: string, defaultPageSize = DEFAULT_PAGE_SIZE, ...fallbackStorageKeys: string[]) {
  if (typeof window === 'undefined') {
    return defaultPageSize;
  }

  for (const currentKey of [storageKey, ...fallbackStorageKeys]) {
    const rawValue = window.localStorage.getItem(currentKey);
    const parsedValue = rawValue ? Number(rawValue) : NaN;

    if (PAGE_SIZE_OPTIONS.includes(parsedValue)) {
      return parsedValue;
    }
  }

  return defaultPageSize;
}
