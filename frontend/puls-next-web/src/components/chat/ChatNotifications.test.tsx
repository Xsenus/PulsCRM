/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestOpenConversation } from '../../app/desktopNotifications';
import { ChatNotifications } from './ChatNotifications';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const chatState = vi.hoisted(() => ({ value: null as any }));
vi.mock('../../app/ChatContext', () => ({ useOptionalChat: () => chatState.value }));
vi.mock('../../chat.css', () => ({}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let path = '';

function LocationProbe() {
  path = useLocation().pathname;
  return null;
}

function render(initialPath: string) {
  chatState.value = { notifications: [], dock: { open: false, conversationId: null }, openDock: vi.fn(), dismissNotification: vi.fn() };
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container!);
    root.render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="*" element={<><ChatNotifications /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>
    );
  });
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
});

describe('ChatNotifications — system notification click', () => {
  it('opens the conversation in the floating window on regular pages', () => {
    render('/organizations');
    act(() => requestOpenConversation(10));
    expect(chatState.value.openDock).toHaveBeenCalledWith(10);
    expect(path).toBe('/organizations');
  });

  it('navigates to the conversation on the chat page', () => {
    render('/chat');
    act(() => requestOpenConversation(11));
    expect(path).toBe('/chat/11');
    expect(chatState.value.openDock).not.toHaveBeenCalled();
  });
});
