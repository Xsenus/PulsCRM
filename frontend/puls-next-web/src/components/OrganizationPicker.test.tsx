/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrganizationPicker } from './OrganizationPicker';
import type { OrganizationListItemDto } from '../app/types';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../app/AuthContext', () => ({
  useAuth: () => ({ user: { id: 7 } })
}));

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

function organization(overrides: Partial<OrganizationListItemDto>): OrganizationListItemDto {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Организация',
    visible: true,
    isManager: false,
    emails: overrides.emails ?? [],
    emailCount: overrides.emailCount ?? 0,
    contactCount: overrides.contactCount ?? 0,
    openWorkItems: 0,
    ...overrides
  };
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

describe('OrganizationPicker', () => {
  it('renders selected recipient organization summary', () => {
    const view = render(
      <OrganizationPicker
        value={[
          organization({ id: 1, name: 'Первая организация', emailCount: 2, contactCount: 3 }),
          organization({ id: 2, name: 'Вторая организация', emailCount: 0, contactCount: 1 })
        ]}
        onChange={vi.fn()}
      />
    );

    const summary = view.querySelector('.organization-recipient-summary');

    expect(summary?.textContent).toContain('Организаций2');
    expect(summary?.textContent).toContain('Известных email2');
    expect(summary?.textContent).toContain('С email1');
    expect(summary?.textContent).toContain('Без email1');
    expect(summary?.textContent).toContain('Контактов4');
    expect(view.textContent).toContain('Первая организация');
    expect(view.textContent).toContain('Вторая организация');
  });
});
