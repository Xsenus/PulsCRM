/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TransportProfilesPage } from './TransportProfilesPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const apiMocks = vi.hoisted(() => ({
  deleteTransportProfile: vi.fn(),
  getTransportProfiles: vi.fn(),
  saveTransportProfile: vi.fn(),
  testTransportProfile: vi.fn()
}));

vi.mock('../app/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 7,
      login: 'tester',
      fullName: 'Тестовый пользователь',
      isRoot: true
    },
    loading: false,
    isAuthenticated: true,
    login: async () => undefined,
    logout: () => undefined
  })
}));

vi.mock('../app/api', () => ({
  deleteTransportProfile: apiMocks.deleteTransportProfile,
  getTransportProfiles: apiMocks.getTransportProfiles,
  saveTransportProfile: apiMocks.saveTransportProfile,
  testTransportProfile: apiMocks.testTransportProfile
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

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

function click(element: Element) {
  act(() => {
    Simulate.click(element as Element);
  });
}

beforeEach(() => {
  apiMocks.deleteTransportProfile.mockResolvedValue(undefined);
  apiMocks.getTransportProfiles.mockResolvedValue([]);
  apiMocks.saveTransportProfile.mockResolvedValue({});
  apiMocks.testTransportProfile.mockResolvedValue({ success: true, message: 'SMTP ok' });
});

afterEach(() => {
  root?.unmount();
  root = null;
  container?.remove();
  container = null;
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('TransportProfilesPage', () => {
  it('marks settings groups as tabs and switches the active group', async () => {
    const view = render(<TransportProfilesPage />);
    await flushEffects();

    const tablist = view.querySelector('.settings-tabs[role="tablist"]');
    const tabs = Array.from(view.querySelectorAll<HTMLButtonElement>('.settings-tab'));
    const profileSearch = view.querySelector<HTMLInputElement>('[aria-label="Поиск SMTP профилей по профилю, серверу, логину или email"]');
    const createProfileButton = view.querySelector<HTMLButtonElement>('[aria-label="Создать новый SMTP профиль"]');

    expect(tablist?.getAttribute('aria-label')).toBe('Группы настроек');
    expect(profileSearch).toBeInstanceOf(HTMLInputElement);
    expect(createProfileButton).toBeInstanceOf(HTMLButtonElement);
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Основные', 'SMTP профили']);
    expect(tabs.map((tab) => tab.getAttribute('role'))).toEqual(['tab', 'tab']);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    expect(tabs.map((tab) => tab.getAttribute('aria-label'))).toEqual([
      'Основные: открыть раздел',
      'SMTP профили: текущий раздел'
    ]);

    click(tabs[0]);

    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(tabs.map((tab) => tab.getAttribute('aria-label'))).toEqual([
      'Основные: текущий раздел',
      'SMTP профили: открыть раздел'
    ]);
    expect(tabs.map((tab) => tab.className.includes('active'))).toEqual([true, false]);
    expect(view.querySelector('[aria-label="Создать новый SMTP профиль"]')).toBeNull();
  });

  it('renders SMTP profile dates as machine-readable time elements', async () => {
    apiMocks.getTransportProfiles.mockResolvedValue([
      {
        id: 42,
        name: 'SMTP основной',
        host: 'smtp.example.test',
        port: 587,
        useSsl: true,
        username: 'smtp-user',
        senderEmail: 'sender@example.test',
        senderName: 'Puls CRM',
        replyToEmail: 'reply@example.test',
        maxConnections: 2,
        messagesPerMinute: 60,
        isDefault: true,
        isEnabled: true,
        createdAtUtc: '2026-06-15T06:30:00.000Z',
        updatedAtUtc: '2026-06-18T09:45:00.000Z'
      }
    ]);
    window.localStorage.setItem('puls-table-settings:transport-profiles-list:7', JSON.stringify({
      columns: [
        { key: 'createdAtUtc', visible: true, width: 180 },
        { key: 'updatedAtUtc', visible: true, width: 180 }
      ]
    }));

    const view = render(<TransportProfilesPage />);
    await flushEffects();

    const tableTimes = Array.from(view.querySelectorAll<HTMLTableElement>('table time'));

    expect(tableTimes.map((item) => item.getAttribute('dateTime'))).toEqual([
      '2026-06-15T06:30:00.000Z',
      '2026-06-18T09:45:00.000Z'
    ]);

    const rowActionsButton = view.querySelector<HTMLButtonElement>('.row-actions-menu-trigger');
    expect(rowActionsButton).not.toBeNull();
    expect(rowActionsButton?.getAttribute('aria-label')).toBe('Действия SMTP профиля SMTP основной');
    click(rowActionsButton!);
    await flushEffects();

    const editAction = view.querySelector<HTMLButtonElement>('[role="menuitem"]');
    expect(editAction).not.toBeNull();
    click(editAction!);
    await flushEffects();

    const metaTimes = Array.from(document.body.querySelectorAll<HTMLTimeElement>('.settings-form-meta time'));

    expect(document.body.querySelector('[aria-label="Проверить SMTP профиль #42"]')).toBeInstanceOf(HTMLButtonElement);
    expect(document.body.querySelector('[aria-label="Закрыть форму SMTP профиля #42"]')).toBeInstanceOf(HTMLButtonElement);
    expect(document.body.querySelector('[aria-label="Сохранить SMTP профиль #42"]')).toBeInstanceOf(HTMLButtonElement);
    expect(metaTimes.map((item) => item.getAttribute('dateTime'))).toEqual([
      '2026-06-15T06:30:00.000Z',
      '2026-06-18T09:45:00.000Z'
    ]);
  });

  it('labels SMTP profile form fields for assistive technologies', async () => {
    const view = render(<TransportProfilesPage />);
    await flushEffects();

    const createButton = view.querySelector<HTMLButtonElement>('.page-header-actions .primary-button');
    expect(createButton).not.toBeNull();
    click(createButton!);
    await flushEffects();

    const expectedLabels = [
      'Название SMTP профиля',
      'SMTP сервер профиля',
      'Порт SMTP профиля',
      'Логин SMTP профиля',
      'Пароль SMTP профиля',
      'Адрес отправителя SMTP профиля',
      'Имя отправителя SMTP профиля',
      'Адрес для ответа SMTP профиля',
      'Максимум соединений SMTP профиля',
      'Лимит писем в минуту SMTP профиля'
    ];

    for (const label of expectedLabels) {
      expect(document.body.querySelector(`[aria-label="${label}"]`)).toBeInstanceOf(HTMLInputElement);
    }

    expect(document.body.querySelector('[aria-label="Закрыть форму нового SMTP профиля"]')).toBeInstanceOf(HTMLButtonElement);
    expect(document.body.querySelector('[aria-label="Сохранить новый SMTP профиль"]')).toBeInstanceOf(HTMLButtonElement);

    const expectedToggleLabels = [
      'Использовать SSL для SMTP профиля',
      'Сделать SMTP профиль профилем по умолчанию',
      'SMTP профиль активен'
    ];

    for (const label of expectedToggleLabels) {
      expect(document.body.querySelector(`[aria-label="${label}"]`)).toBeInstanceOf(HTMLInputElement);
    }
  });

  it('labels delete confirmation actions with SMTP profile context', async () => {
    apiMocks.getTransportProfiles.mockResolvedValue([
      {
        id: 42,
        name: 'SMTP основной',
        host: 'smtp.example.test',
        port: 587,
        useSsl: true,
        username: 'smtp-user',
        senderEmail: 'sender@example.test',
        senderName: 'Puls CRM',
        replyToEmail: 'reply@example.test',
        maxConnections: 2,
        messagesPerMinute: 60,
        isDefault: true,
        isEnabled: true,
        createdAtUtc: '2026-06-15T06:30:00.000Z',
        updatedAtUtc: '2026-06-18T09:45:00.000Z'
      }
    ]);

    const view = render(<TransportProfilesPage />);
    await flushEffects();

    const rowActionsButton = view.querySelector<HTMLButtonElement>('.row-actions-menu-trigger');
    expect(rowActionsButton).not.toBeNull();
    click(rowActionsButton!);
    await flushEffects();

    const actions = Array.from(view.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    click(actions[2]);
    await flushEffects();

    expect(document.body.querySelector('[aria-label="Отменить удаление SMTP профиля SMTP основной"]')).toBeInstanceOf(HTMLButtonElement);
    expect(document.body.querySelector('[aria-label="Удалить SMTP профиль SMTP основной"]')).toBeInstanceOf(HTMLButtonElement);
  });
});
