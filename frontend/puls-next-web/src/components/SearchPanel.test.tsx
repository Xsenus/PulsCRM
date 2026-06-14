/** @vitest-environment jsdom */
import React, { useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOAST_EVENT, type ToastMessage } from '../app/toast';
import { SearchPanel } from './SearchPanel';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(ui: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);

  act(() => {
    root = createRoot(container!);
    root.render(ui);
  });

  return container;
}

function dispatchInput(input: HTMLInputElement, value: string) {
  act(() => {
    Simulate.change(input, { target: { value } } as any);
  });
}

function click(element: Element) {
  act(() => {
    Simulate.click(element as Element);
  });
}

afterEach(() => {
  vi.useRealTimers();

  if (root && container) {
    act(() => {
      root?.unmount();
    });
  }

  root = null;
  container?.remove();
  container = null;
});

describe('SearchPanel', () => {
  it('debounces value changes after initial render', () => {
    vi.useFakeTimers();
    const onDebouncedChange = vi.fn();

    function Harness() {
      const [value, setValue] = useState('');

      return (
        <SearchPanel
          value={value}
          placeholder="Search"
          onChange={setValue}
          onSearch={vi.fn()}
          onClear={() => setValue('')}
          onDebouncedChange={onDebouncedChange}
          debounceMs={300}
        />
      );
    }

    const view = render(<Harness />);
    const input = view.querySelector<HTMLInputElement>('input[type="search"]')!;

    dispatchInput(input, 'alpha');

    expect(onDebouncedChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(onDebouncedChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDebouncedChange).toHaveBeenCalledWith('alpha');
  });

  it('clears pending debounce and focuses input when clear button is clicked', () => {
    vi.useFakeTimers();
    const onDebouncedChange = vi.fn();

    function Harness() {
      const [value, setValue] = useState('initial');

      return (
        <SearchPanel
          value={value}
          placeholder="Search"
          onChange={setValue}
          onSearch={vi.fn()}
          onClear={() => setValue('')}
          onDebouncedChange={onDebouncedChange}
          debounceMs={300}
        />
      );
    }

    const view = render(<Harness />);
    const input = view.querySelector<HTMLInputElement>('input[type="search"]')!;

    dispatchInput(input, 'alpha');
    click(view.querySelector('button[aria-label="Сбросить поиск"]')!);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
    expect(onDebouncedChange).not.toHaveBeenCalled();
  });

  it('runs search immediately on Enter and search button click', () => {
    const onSearch = vi.fn();
    const view = render(
      <SearchPanel
        value="query"
        placeholder="Search"
        onChange={vi.fn()}
        onSearch={onSearch}
        onClear={vi.fn()}
      />
    );

    const input = view.querySelector<HTMLInputElement>('input[type="search"]')!;
    act(() => {
      Simulate.keyDown(input, { key: 'Enter' } as any);
    });

    click(view.querySelector('button[aria-label="Найти"]')!);

    expect(onSearch).toHaveBeenCalledTimes(2);
  });

  it('shows readable refresh errors from rejected strings', async () => {
    const toasts: ToastMessage[] = [];
    const onToast = (event: Event) => {
      toasts.push((event as CustomEvent<ToastMessage>).detail);
    };
    window.addEventListener(TOAST_EVENT, onToast);

    const view = render(
      <SearchPanel
        value=""
        placeholder="Search"
        onChange={vi.fn()}
        onSearch={vi.fn()}
        onClear={vi.fn()}
        onRefresh={() => Promise.reject('Не удалось обновить список.')}
        refreshErrorMessage="Ошибка обновления."
      />
    );

    try {
      await act(async () => {
        Simulate.click(view.querySelector('button[aria-label="Обновить список"]')!);
      });

      expect(toasts[toasts.length - 1]).toMatchObject({
        message: 'Не удалось обновить список.',
        type: 'error'
      });
    } finally {
      window.removeEventListener(TOAST_EVENT, onToast);
    }
  });
});
