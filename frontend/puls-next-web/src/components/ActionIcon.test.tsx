/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { ActionIcon, type ActionIconKind } from './ActionIcon';

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

describe('ActionIcon', () => {
  it('renders every supported action icon as decorative svg', () => {
    const kinds: ActionIconKind[] = [
      'actions',
      'back',
      'chevronDown',
      'clear',
      'first',
      'last',
      'next',
      'previous',
      'refresh',
      'search'
    ];

    const view = render(
      <>
        {kinds.map((kind) => (
          <ActionIcon key={kind} kind={kind} className={`icon-${kind}`} />
        ))}
      </>
    );

    const icons = Array.from(view.querySelectorAll('svg'));
    expect(icons).toHaveLength(kinds.length);

    icons.forEach((icon, index) => {
      expect(icon.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      expect(icon.getAttribute('focusable')).toBe('false');
      expect(icon.classList.contains(`icon-${kinds[index]}`)).toBe(true);
      expect(icon.querySelector('path, circle')).not.toBeNull();
    });
  });
});
