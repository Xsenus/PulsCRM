import React, { useEffect, useRef, useState } from 'react';
import { showToast } from '../app/toast';

type SearchActionKind = 'clear' | 'refresh' | 'search';

interface SearchPanelProps {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  onClear: () => void;
  onRefresh?: () => Promise<void> | void;
  onDebouncedChange?: (value: string) => void;
  debounceMs?: number;
  refreshSuccessMessage?: string;
  refreshErrorMessage?: string;
  panelClassName?: string;
  inputClassName?: string;
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function SearchActionIcon({ kind }: { kind: SearchActionKind }) {
  if (kind === 'clear') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === 'refresh') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19 7v5h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18.4 12a6.4 6.4 0 10-1.88 4.53L19 14.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function SearchPanel({
  value,
  placeholder,
  onChange,
  onSearch,
  onClear,
  onRefresh,
  onDebouncedChange,
  debounceMs = 450,
  refreshSuccessMessage = 'Обновление завершено.',
  refreshErrorMessage = 'Не удалось обновить данные.',
  panelClassName,
  inputClassName
}: SearchPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const hasMountedRef = useRef(false);
  const skipNextDebouncedChangeRef = useRef(false);
  const debouncedChangeRef = useRef(onDebouncedChange);
  const [refreshing, setRefreshing] = useState(false);

  const resolvedPanelClassName = ['panel', 'search-panel', panelClassName].filter(Boolean).join(' ');
  const resolvedInputClassName = ['form-input', 'search-input', inputClassName].filter(Boolean).join(' ');

  const clearDebounceTimer = () => {
    if (debounceTimeoutRef.current !== null) {
      window.clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    debouncedChangeRef.current = onDebouncedChange;
  }, [onDebouncedChange]);

  useEffect(() => {
    if (!debouncedChangeRef.current) {
      return;
    }

    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    if (skipNextDebouncedChangeRef.current) {
      skipNextDebouncedChangeRef.current = false;
      return;
    }

    clearDebounceTimer();
    debounceTimeoutRef.current = window.setTimeout(() => {
      debounceTimeoutRef.current = null;
      debouncedChangeRef.current?.(value);
    }, debounceMs);

    return clearDebounceTimer;
  }, [debounceMs, value]);

  useEffect(() => clearDebounceTimer, []);

  const handleSearch = () => {
    clearDebounceTimer();
    onSearch();
  };

  const handleClear = () => {
    clearDebounceTimer();

    if (value) {
      skipNextDebouncedChangeRef.current = true;
    }

    onClear();
    inputRef.current?.focus();
  };

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) {
      return;
    }

    setRefreshing(true);

    try {
      await onRefresh();
      showToast(refreshSuccessMessage, 'success');
    } catch (error) {
      showToast(toErrorMessage(error, refreshErrorMessage), 'error', 4000);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className={resolvedPanelClassName}>
      <div className="search-shell">
        <input
          ref={inputRef}
          type="search"
          className={resolvedInputClassName}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleSearch();
            }
          }}
        />

        <div className="search-actions">
          <button
            type="button"
            className="primary-button button-inline icon-button search-button search-action-button search-action-button-primary"
            onClick={handleSearch}
            aria-label="Найти"
            title="Найти"
          >
            <span className="search-action-icon">
              <SearchActionIcon kind="search" />
            </span>
          </button>

          <button
            type="button"
            className="secondary-button button-inline icon-button search-button search-action-button"
            onClick={handleClear}
            aria-label="Сбросить поиск"
            title="Сбросить"
          >
            <span className="search-action-icon">
              <SearchActionIcon kind="clear" />
            </span>
          </button>

          {onRefresh ? (
            <button
              type="button"
              className={`secondary-button button-inline icon-button search-button search-action-button${refreshing ? ' refreshing' : ''}`}
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              aria-label={refreshing ? 'Обновляем список' : 'Обновить список'}
              title={refreshing ? 'Обновляем...' : 'Обновить'}
            >
              <span className="search-action-icon">
                <SearchActionIcon kind="refresh" />
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
