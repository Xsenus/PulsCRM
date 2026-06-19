/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OrganizationDetailsDto, OrganizationUpsertRequest } from '../../app/types';
import { OrganizationSidebar } from './OrganizationSidebar';

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

function createDraft(overrides: Partial<OrganizationUpsertRequest> = {}): OrganizationUpsertRequest {
  return {
    name: 'Администрация тестового района',
    fullName: 'Муниципальная организация тестового района',
    inn: '5400000000',
    kpp: '540001001',
    ogrn: '1025400000000',
    phone: '+7 (383) 200-00-00',
    site: 'puls.example.test',
    addressLegal: 'г. Новосибирск, Красный проспект, 1',
    addressActual: 'г. Новосибирск, Советская, 2',
    comment: 'Рабочий комментарий организации',
    otherInfo: 'Дополнительная информация',
    ...overrides
  } as OrganizationUpsertRequest;
}

function createDetails(overrides: Partial<OrganizationDetailsDto> = {}): OrganizationDetailsDto {
  return {
    id: 7,
    name: 'Администрация',
    fullName: 'Администрация полного цикла',
    inn: '5400000000',
    kpp: '540001001',
    ogrn: '1025400000000',
    phone: '+7 (383) 100-00-00',
    site: 'legacy.example.test',
    addressLegal: 'Юридический адрес из базы',
    addressActual: 'Фактический адрес из базы',
    internetSpeed: '100 Мбит/с',
    edo: 'Диадок',
    debtAmount: 1234.5,
    debtActualAmount: 100,
    debtMinus6Amount: 50,
    openWorkItems: 3,
    updatedAtUtc: '2026-06-11T06:00:00Z',
    updatedByName: 'Оператор',
    tasks: [
      { id: 1, name: 'Проверить договор', fullName: '' }
    ],
    comment: 'Комментарий из базы',
    otherInfo: 'Прочее из базы',
    ...overrides
  } as unknown as OrganizationDetailsDto;
}

describe('OrganizationSidebar', () => {
  it('renders organization facts, links, counters and quick actions', () => {
    const onOpenRelations = vi.fn();
    const onOpenHistory = vi.fn();
    const view = render(
      <OrganizationSidebar
        details={createDetails()}
        draft={createDraft()}
        emailChips={['office@example.test', 'director@example.test']}
        onOpenRelations={onOpenRelations}
        onOpenHistory={onOpenHistory}
      />
    );

    expect(view.textContent).toContain('Паспорт организации');
    expect(view.textContent).toContain('5400000000 / 540001001');
    expect(view.textContent).toContain('1 234,50');
    expect(view.textContent).toContain('Проверить договор');
    expect(view.querySelector('a[href="tel:+73832000000"]')?.textContent).toBe('+7 (383) 200-00-00');
    expect(view.querySelector('a[href="https://puls.example.test"]')?.textContent).toBe('puls.example.test');
    expect(view.querySelector('a[href="mailto:office@example.test"]')?.textContent).toBe('office@example.test');
    const quickToolbar = view.querySelector('[role="toolbar"]');
    expect(quickToolbar?.getAttribute('aria-label')).toBe('Быстрые переходы организации');
    expect(quickToolbar?.querySelectorAll('button')).toHaveLength(5);
    const lists = Array.from(view.querySelectorAll('[role="list"]'));
    expect(lists.map((list) => list.getAttribute('aria-label'))).toEqual([
      'Паспортные данные организации',
      'Статус и сопровождение организации',
      'Финансовые показатели организации',
      'Почтовые адреса организации',
      'Задачи организации',
      'Контекст карточки организации'
    ]);
    expect(lists[0].querySelectorAll('[role="listitem"]')).toHaveLength(4);
    expect(lists[1].querySelectorAll('[role="listitem"]')).toHaveLength(4);
    expect(lists[2].querySelectorAll('[role="listitem"]')).toHaveLength(4);
    expect(lists[3].querySelectorAll('[role="listitem"]')).toHaveLength(2);
    expect(lists[4].querySelectorAll('[role="listitem"]')).toHaveLength(1);
    expect(lists[5].querySelectorAll('[role="listitem"]')).toHaveLength(3);

    click(Array.from(view.querySelectorAll('button')).find((button) => button.textContent === 'Документы')!);
    click(Array.from(view.querySelectorAll('button')).find((button) => button.textContent === 'Снимки 1С')!);

    expect(onOpenRelations).toHaveBeenCalledWith('documents');
    expect(onOpenHistory).toHaveBeenCalledWith('snapshots');
  });

  it('renders empty states without details and email chips', () => {
    const view = render(
      <OrganizationSidebar
        details={null}
        draft={createDraft({ inn: undefined, kpp: undefined, ogrn: undefined, phone: undefined, site: undefined })}
        emailChips={[]}
        onOpenRelations={vi.fn()}
        onOpenHistory={vi.fn()}
      />
    );

    expect(view.textContent).toContain('Почтовые адреса еще не заполнены.');
    expect(view.textContent).toContain('Связанные задачи по организации не найдены.');
    expect(view.textContent).toContain('Не заполнено');
  });
});
