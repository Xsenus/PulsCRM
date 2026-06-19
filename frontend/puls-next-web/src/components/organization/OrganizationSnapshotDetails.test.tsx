/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import type { OrganizationOneCSnapshotDto } from '../../app/types';
import { OrganizationSnapshotDetails } from './OrganizationSnapshotDetails';

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

const snapshot: OrganizationOneCSnapshotDto = {
  key: 'current',
  title: 'Текущие реквизиты',
  code: 'ORG-42',
  raion: 'Центральный',
  name: 'Пульс',
  fullName: 'ООО Пульс',
  inn: '5400000000',
  phone: '+7 (383) 200-00-00',
  otherInfo: 'Поддержка активна',
  comment: 'Проверено',
  addressLegal: '630000, Новосибирск',
  addressActual: 'Новосибирск, офис 10'
};

describe('OrganizationSnapshotDetails', () => {
  it('renders all snapshot fields and keeps phone clickable', () => {
    const view = render(<OrganizationSnapshotDetails snapshot={snapshot} />);
    const phone = view.querySelector('a[href="tel:+73832000000"]');
    const list = view.querySelector('[role="list"]');

    expect(list?.getAttribute('aria-label')).toBe('Поля снимка 1С организации');
    expect(list?.querySelectorAll('[role="listitem"]')).toHaveLength(10);
    expect(view.querySelectorAll('.detail-card')).toHaveLength(10);
    expect(view.textContent).toContain('Код');
    expect(view.textContent).toContain('ORG-42');
    expect(view.textContent).toContain('ООО Пульс');
    expect(view.textContent).toContain('Юридический адрес');
    expect(phone?.textContent).toBe('+7 (383) 200-00-00');
  });

  it('renders fallback values for missing optional fields when snapshot has partial data', () => {
    const view = render(<OrganizationSnapshotDetails snapshot={{ key: 'partial', title: 'Архив', code: 'A-1' }} />);
    const fallbackValues = Array.from(view.querySelectorAll('.detail-card span')).filter((item) => item.textContent === '-');

    expect(view.textContent).toContain('A-1');
    expect(fallbackValues.length).toBeGreaterThan(0);
  });

  it('renders empty state when selected snapshot has no data', () => {
    const view = render(<OrganizationSnapshotDetails snapshot={{ key: 'empty', title: 'Пустой снимок' }} />);
    const emptyState = view.querySelector('.organization-record-inline-empty');

    expect(emptyState?.getAttribute('role')).toBe('status');
    expect(emptyState?.textContent).toBe('В выбранном снимке нет данных.');
    expect(view.querySelector('.detail-grid')).toBeNull();
  });

  it('renders empty state when snapshot is missing', () => {
    const view = render(<OrganizationSnapshotDetails />);

    expect(view.querySelector('.organization-record-inline-empty')?.getAttribute('role')).toBe('status');
    expect(view.textContent).toBe('В выбранном снимке нет данных.');
  });
});
