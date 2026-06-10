/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';

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

function click(element: Element) {
  act(() => {
    Simulate.click(element as Element);
  });
}

afterEach(() => {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
  }

  root = null;
  container?.remove();
  container = null;
});

describe('Pagination', () => {
  it('calls page change handlers for page buttons and navigation buttons', () => {
    const onPageChange = vi.fn();
    const view = render(
      <Pagination
        page={3}
        pageSize={25}
        totalCount={125}
        onPageChange={onPageChange}
      />
    );

    click(view.querySelector('.pagination-page-button:nth-of-type(4)')!);
    click(view.querySelector('button[aria-label="Назад"]')!);
    click(view.querySelector('button[aria-label="В конец"]')!);

    expect(onPageChange).toHaveBeenNthCalledWith(1, 4);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 2);
    expect(onPageChange).toHaveBeenNthCalledWith(3, 5);
  });

  it('opens page size menu and selects a new page size', () => {
    const onPageSizeChange = vi.fn();
    const view = render(
      <Pagination
        page={1}
        pageSize={25}
        totalCount={200}
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={[10, 25, 50]}
      />
    );

    const trigger = view.querySelector('.pagination-size-trigger')!;
    click(trigger);

    const options = Array.from(view.querySelectorAll<HTMLButtonElement>('.pagination-size-option'));
    expect(options.map((option) => option.textContent)).toEqual(['10', '25', '50']);

    click(options[2]);

    expect(onPageSizeChange).toHaveBeenCalledWith(50);
    expect(view.querySelector('.pagination-size-menu')).toBeNull();
  });
});
