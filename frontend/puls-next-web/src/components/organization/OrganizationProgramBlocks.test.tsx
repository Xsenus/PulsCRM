/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import type { OrganizationInfoTaskDto } from '../../app/types';
import { OrganizationProgramBlocks } from './OrganizationProgramBlocks';

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

const items: OrganizationInfoTaskDto[] = [
  {
    id: 1,
    variant: 0,
    name: 'Бухгалтерия',
    fullName: 'Бухгалтерия учреждения',
    places: 5,
    comment: 'Активный блок',
    organizationCreatorName: 'Пульс',
    updatedByName: 'Администратор',
    updatedAtUtc: '2026-06-12T03:00:00Z'
  },
  {
    id: 2,
    variant: 42,
    name: 'Нестандартный блок',
    places: 0,
    comment: '  ',
    updatedByName: 'Техподдержка'
  }
];

describe('OrganizationProgramBlocks', () => {
  it('renders known program cards and extra variants', () => {
    const view = render(<OrganizationProgramBlocks items={items} />);
    const lists = Array.from(view.querySelectorAll('[role="list"]'));
    const cards = Array.from(view.querySelectorAll('.organization-program-card'));
    const times = Array.from(view.querySelectorAll('time'));

    expect(lists.map((list) => list.getAttribute('aria-label'))).toEqual([
      'Типовые блоки программ организации',
      'Дополнительные блоки программ организации'
    ]);
    expect(view.querySelector('h4')?.textContent).toBe('Блоки программ');
    expect(view.textContent).toContain('2 записей');
    expect(cards).toHaveLength(11);
    expect(view.querySelectorAll('[role="listitem"]')).toHaveLength(11);
    expect(view.textContent).toContain('Бухгалтерия учреждения');
    expect(view.textContent).toContain('Рабочих мест: 5');
    expect(times.map((time) => time.getAttribute('dateTime'))).toEqual(['2026-06-12T03:00:00Z']);
    expect(view.textContent).toContain('#42');
    expect(view.textContent).toContain('Нестандартный блок');
    expect(view.textContent).toContain('Комментарий не заполнен');
  });

  it('renders empty known cards when items are missing', () => {
    const view = render(<OrganizationProgramBlocks items={null} />);
    const lists = Array.from(view.querySelectorAll('[role="list"]'));
    const cards = Array.from(view.querySelectorAll('.organization-program-card'));
    const emptyCards = Array.from(view.querySelectorAll('.organization-program-card-empty'));

    expect(lists.map((list) => list.getAttribute('aria-label'))).toEqual(['Типовые блоки программ организации']);
    expect(view.textContent).toContain('0 записей');
    expect(cards).toHaveLength(10);
    expect(view.querySelectorAll('[role="listitem"]')).toHaveLength(10);
    expect(emptyCards).toHaveLength(10);
    expect(view.textContent).toContain('Запись пока не заполнена');
  });
});
