/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { OrganizationStatusBar } from './OrganizationStatusBar';

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

describe('OrganizationStatusBar', () => {
  it('renders visibility, manager and lookup chips', () => {
    const view = render(
      <OrganizationStatusBar
        visible
        isManager
        isDirty={false}
        raionName="Центральный район"
        orgTypeName="Бюджетное учреждение"
        statusName="Работает"
        flagName="Важная"
      />
    );
    const statusList = view.querySelector('[role="list"]');
    const chips = Array.from(view.querySelectorAll('.organization-chip')).map((item) => item.textContent);
    const saveStatus = view.querySelector('.organization-status-pill');

    expect(statusList?.getAttribute('aria-label')).toBe('Статусы организации');
    expect(view.querySelectorAll('[role="listitem"]')).toHaveLength(6);
    expect(chips).toEqual([
      'Видима',
      'Для менеджера',
      'Центральный район',
      'Бюджетное учреждение',
      'Работает',
      'Важная'
    ]);
    expect(saveStatus?.getAttribute('role')).toBe('status');
    expect(saveStatus?.textContent).toBe('Все изменения сохранены');
    expect(saveStatus?.className).toBe('organization-status-pill organization-status-pill--ok');
  });

  it('hides optional chips and marks dirty draft', () => {
    const view = render(<OrganizationStatusBar visible={false} isManager={false} isDirty />);

    expect(Array.from(view.querySelectorAll('.organization-chip')).map((item) => item.textContent)).toEqual(['Скрыта']);
    expect(view.querySelectorAll('[role="listitem"]')).toHaveLength(1);
    expect(view.textContent).toContain('Черновик изменен');
    expect(view.querySelector('.organization-status-pill')?.getAttribute('role')).toBe('status');
    expect(view.querySelector('.organization-status-pill')?.className).toBe(
      'organization-status-pill organization-status-pill--warn'
    );
  });
});
