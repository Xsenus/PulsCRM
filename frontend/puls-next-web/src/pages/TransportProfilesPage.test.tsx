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

    expect(tablist?.getAttribute('aria-label')).toBe('Группы настроек');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Основные', 'SMTP профили']);
    expect(tabs.map((tab) => tab.getAttribute('role'))).toEqual(['tab', 'tab']);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    expect(tabs.map((tab) => tab.getAttribute('aria-label'))).toEqual([
      'Основные: открыть раздел',
      'SMTP профили: текущий раздел'
    ]);
    expect(view.textContent).toContain('Новый профиль');

    click(tabs[0]);

    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(tabs.map((tab) => tab.getAttribute('aria-label'))).toEqual([
      'Основные: текущий раздел',
      'SMTP профили: открыть раздел'
    ]);
    expect(tabs.map((tab) => tab.className.includes('active'))).toEqual([true, false]);
    expect(view.textContent).not.toContain('Новый профиль');
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
    click(rowActionsButton!);
    await flushEffects();

    const editAction = view.querySelector<HTMLButtonElement>('[role="menuitem"]');
    expect(editAction).not.toBeNull();
    click(editAction!);
    await flushEffects();

    const metaTimes = Array.from(document.body.querySelectorAll<HTMLTimeElement>('.settings-form-meta time'));

    expect(metaTimes.map((item) => item.getAttribute('dateTime'))).toEqual([
      '2026-06-15T06:30:00.000Z',
      '2026-06-18T09:45:00.000Z'
    ]);
  });
});
