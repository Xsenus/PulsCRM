/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import type { OrganizationEventDto } from '../../app/types';
import { OrganizationEventTimeline } from './OrganizationEventTimeline';

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

function createEvent(overrides: Partial<OrganizationEventDto> = {}): OrganizationEventDto {
  return {
    id: 15,
    categoryName: 'Сопровождение',
    userName: 'Оператор',
    name: 'Продление лицензии',
    comment: 'Клиент подтвердил продление',
    eventDateUtc: '2026-06-11T06:00:00Z',
    dateFromUtc: '2026-06-01T00:00:00Z',
    dateToUtc: '2026-06-30T00:00:00Z',
    isInProcess: true,
    isCompleted: false,
    licenseKey: 'ITS-001',
    licenseAmount: 1234.5,
    licenseAmountComment: 'Сумма согласована',
    ...overrides
  };
}

describe('OrganizationEventTimeline', () => {
  it('renders event timeline cards with metadata, period and license chips', () => {
    const view = render(
      <OrganizationEventTimeline
        events={[
          createEvent(),
          createEvent({
            id: 16,
            name: undefined,
            taskName: 'Контроль оплаты',
            userName: undefined,
            categoryName: undefined,
            categoryFullName: 'Финансы',
            isInProcess: false,
            isCompleted: true,
            licenseKey: undefined,
            licenseAmount: undefined,
            comment: ''
          })
        ]}
      />
    );

    const list = view.querySelector('[role="list"]');

    expect(list?.getAttribute('aria-label')).toBe('История событий организации');
    expect(view.querySelectorAll('[role="listitem"]')).toHaveLength(2);
    expect(view.querySelectorAll('.organization-timeline-item')).toHaveLength(2);
    expect(view.textContent).toContain('Продление лицензии');
    expect(view.textContent).toContain('Оператор • Сопровождение • в процессе • не завершено');
    expect(view.textContent).toContain('ITS-001');
    expect(view.textContent).toContain('1 234,50');
    expect(view.textContent).toContain('Период:');
    expect(view.textContent).toContain('Клиент подтвердил продление');
    expect(view.textContent).toContain('Комментарий суммы: Сумма согласована');
    expect(view.textContent).toContain('Контроль оплаты');
    expect(view.textContent).toContain('Финансы • завершено');
  });

  it('renders empty state when events are missing', () => {
    const view = render(<OrganizationEventTimeline events={[]} />);

    expect(view.querySelector('.empty-state')?.textContent).toBe('История событий по организации пока пуста.');
  });
});
