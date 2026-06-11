/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RelationPreviewCard } from './RelationPreviewCard';

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

describe('RelationPreviewCard', () => {
  it('renders active preview items and formatted count', () => {
    const onClick = vi.fn();
    const view = render(
      <RelationPreviewCard
        title="Контакты"
        count={1234}
        description="Люди и способы связи"
        active
        onClick={onClick}
        items={[
          { key: '1', title: 'Иван Иванов', caption: 'Директор' },
          { key: '2', title: 'info@example.test' }
        ]}
      />
    );

    const button = view.querySelector('.organization-preview-card')!;
    expect(button.className).toContain('active');
    expect(view.querySelector('.organization-preview-card-count')?.textContent).toBe('1 234');
    expect(view.textContent).toContain('Иван Иванов');
    expect(view.textContent).toContain('Директор');
    expect(view.textContent).toContain('info@example.test');

    click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when preview has no items', () => {
    const view = render(
      <RelationPreviewCard
        title="Документы"
        count={0}
        description="Вложения"
        active={false}
        onClick={vi.fn()}
        items={[]}
      />
    );

    expect(view.querySelector('.organization-preview-card')?.className).not.toContain('active');
    expect(view.textContent).toContain('Пока пусто.');
  });
});
