/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TransportProfilesPage } from './TransportProfilesPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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
  deleteTransportProfile: async () => undefined,
  getTransportProfiles: async () => [],
  saveTransportProfile: async () => ({}),
  testTransportProfile: async () => ({ success: true, message: 'SMTP ok' })
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
    expect(view.textContent).toContain('Новый профиль');

    click(tabs[0]);

    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(tabs.map((tab) => tab.className.includes('active'))).toEqual([true, false]);
    expect(view.textContent).not.toContain('Новый профиль');
  });
});
