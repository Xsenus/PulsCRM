/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const apiMocks = vi.hoisted(() => ({
  getDashboard: vi.fn()
}));

vi.mock('../app/api', () => ({
  getDashboard: apiMocks.getDashboard
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
  apiMocks.getDashboard.mockResolvedValue({
    employees: 7,
    organizations: 19,
    activeCampaigns: 3,
    queueDepth: 11,
    sentLast24Hours: 42,
    failedLast24Hours: 2
  });
});

afterEach(() => {
  root?.unmount();
  root = null;
  container?.remove();
  container = null;
  vi.clearAllMocks();
});

describe('DashboardPage', () => {
  it('labels the refresh action and renders dashboard counters', async () => {
    const view = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
    await flushEffects();

    const refreshButton = view.querySelector<HTMLButtonElement>('[aria-label="Обновить показатели дашборда"]');

    expect(refreshButton).toBeInstanceOf(HTMLButtonElement);
    expect(refreshButton?.getAttribute('title')).toBe('Обновить показатели дашборда');
    expect(view.textContent).toContain('Сотрудники');
    expect(view.textContent).toContain('7');
    expect(view.textContent).toContain('Организации');
    expect(view.textContent).toContain('19');
    expect(apiMocks.getDashboard).toHaveBeenCalledTimes(1);
  });
});
