/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatLinkPreview, extractAppLinks, parseAppLink } from './ChatLinkPreview';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const apiMocks = vi.hoisted(() => ({
  getOrganization: vi.fn(),
  getCampaign: vi.fn(),
  getEmployee: vi.fn()
}));
vi.mock('../../app/api', () => apiMocks);

const ORIGIN = 'https://crm.example.test';

describe('parseAppLink', () => {
  it('recognizes links to CRM objects on the same origin', () => {
    expect(parseAppLink(`${ORIGIN}/organizations/42/edit`, ORIGIN)).toEqual({ kind: 'organization', id: 42, path: '/organizations/42/edit' });
    expect(parseAppLink(`${ORIGIN}/organizations/42`, ORIGIN)).toEqual({ kind: 'organization', id: 42, path: '/organizations/42/edit' });
    expect(parseAppLink(`${ORIGIN}/campaigns/7?tab=stats`, ORIGIN)).toEqual({ kind: 'campaign', id: 7, path: '/campaigns/7' });
    expect(parseAppLink(`${ORIGIN}/employees/3/edit`, ORIGIN)).toEqual({ kind: 'employee', id: 3, path: '/employees/3/edit' });
  });

  it('ignores other sites and other pages', () => {
    expect(parseAppLink('https://evil.example/organizations/42/edit', ORIGIN)).toBeNull();
    expect(parseAppLink(`${ORIGIN}/organizations`, ORIGIN)).toBeNull();
    expect(parseAppLink(`${ORIGIN}/organizations/new`, ORIGIN)).toBeNull();
    expect(parseAppLink(`${ORIGIN}/campaigns/0`, ORIGIN)).toBeNull();
    expect(parseAppLink('not a url', '')).toBeNull();
  });

  it('extracts unique links, at most three', () => {
    const links = extractAppLinks([
      `${ORIGIN}/organizations/1`,
      `${ORIGIN}/organizations/1/edit`,
      'https://google.com',
      `${ORIGIN}/campaigns/2`,
      `${ORIGIN}/employees/3/edit`,
      `${ORIGIN}/employees/4/edit`
    ], ORIGIN);
    expect(links.map((link) => link.path)).toEqual(['/organizations/1/edit', '/campaigns/2', '/employees/3/edit']);
  });
});

describe('ChatLinkPreview', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let path = '';

  function LocationProbe() {
    path = useLocation().pathname;
    return null;
  }

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    vi.clearAllMocks();
  });

  async function render(element: React.ReactElement) {
    container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
      root = createRoot(container!);
      root.render(
        <MemoryRouter initialEntries={['/chat/1']}>
          <Routes>
            <Route path="*" element={<>{element}<LocationProbe /></>} />
          </Routes>
        </MemoryRouter>
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('shows the organization name and opens it inside the app', async () => {
    apiMocks.getOrganization.mockResolvedValue({ id: 42, name: 'ООО «Ромашка»', inn: '7701234567', raion: 'Центральный' });
    await render(<ChatLinkPreview link={{ kind: 'organization', id: 42, path: '/organizations/42/edit' }} />);

    expect(container!.textContent).toContain('Организация #42');
    expect(container!.textContent).toContain('ООО «Ромашка»');
    expect(container!.textContent).toContain('ИНН 7701234567 · Центральный');

    act(() => (container!.querySelector('button') as HTMLButtonElement).click());
    expect(path).toBe('/organizations/42/edit');
  });

  it('says so when the object is unavailable', async () => {
    apiMocks.getCampaign.mockRejectedValue(new Error('404'));
    await render(<ChatLinkPreview link={{ kind: 'campaign', id: 99, path: '/campaigns/99' }} />);
    expect(container!.textContent).toContain('Нет доступа или объект удален');
  });
});
