/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const authMocks = vi.hoisted(() => ({
  login: vi.fn()
}));

const apiMocks = vi.hoisted(() => ({
  getLoginUsers: vi.fn()
}));

vi.mock('../app/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    login: authMocks.login
  })
}));

vi.mock('../app/api', () => ({
  getLoginUsers: apiMocks.getLoginUsers
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
    await Promise.resolve();
  });
}

beforeEach(() => {
  authMocks.login.mockResolvedValue(undefined);
  apiMocks.getLoginUsers.mockResolvedValue([]);
  window.localStorage.setItem('puls-last-login-profile', JSON.stringify({
    id: 7,
    login: 'tester',
    fullName: 'Тестовый пользователь',
    userGroup: 'Администраторы',
    lastUsedAt: '2026-06-21T12:30:00.000Z'
  }));
});

afterEach(() => {
  root?.unmount();
  root = null;
  container?.remove();
  container = null;
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('LoginPage', () => {
  it('renders last login date as a machine-readable time element', async () => {
    const view = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    await flushEffects();

    const lastLoginMeta = view.querySelector('.login-last-user-meta');
    const lastLoginTime = lastLoginMeta?.querySelector('time');

    expect(lastLoginMeta?.textContent).toContain('tester / Администраторы /');
    expect(lastLoginTime?.getAttribute('dateTime')).toBe('2026-06-21T12:30:00.000Z');
  });
});
