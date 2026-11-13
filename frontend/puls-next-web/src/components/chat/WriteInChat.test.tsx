/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WriteInChatButton } from './WriteInChat';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const apiMocks = vi.hoisted(() => ({ openDirectChat: vi.fn() }));
const chatState = vi.hoisted(() => ({ value: null as any }));
const toastMock = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock('../../app/chatApi', () => apiMocks);
vi.mock('../../app/ChatContext', () => ({ useOptionalChat: () => chatState.value }));
vi.mock('../../app/toast', () => toastMock);

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(element: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container!);
    root.render(element);
  });
}

beforeEach(() => {
  chatState.value = { enabled: true, currentUserId: 1, upsertConversation: vi.fn(), openDock: vi.fn() };
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  vi.clearAllMocks();
});

describe('WriteInChatButton', () => {
  it('opens a direct conversation in the floating window', async () => {
    apiMocks.openDirectChat.mockResolvedValue({ id: 55, title: 'Борис' });
    render(<WriteInChatButton userId={2} userGroup="Продажи" />);

    await act(async () => {
      (container!.querySelector('button') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(apiMocks.openDirectChat).toHaveBeenCalledWith(2);
    expect(chatState.value.upsertConversation).toHaveBeenCalledWith({ id: 55, title: 'Борис' });
    expect(chatState.value.openDock).toHaveBeenCalledWith(55);
  });

  it('is hidden for yourself, for fired employees and when chat is off', () => {
    render(<WriteInChatButton userId={1} />);
    expect(container!.querySelector('button')).toBeNull();
    act(() => root?.unmount());

    render(<WriteInChatButton userId={2} userGroup=" Уволенные " />);
    expect(container!.querySelector('button')).toBeNull();
    act(() => root?.unmount());

    chatState.value = { ...chatState.value, enabled: false };
    render(<WriteInChatButton userId={2} />);
    expect(container!.querySelector('button')).toBeNull();
  });

  it('shows the server error', async () => {
    apiMocks.openDirectChat.mockRejectedValue(new Error('boom'));
    render(<WriteInChatButton userId={2} />);
    await act(async () => {
      (container!.querySelector('button') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(toastMock.showToast).toHaveBeenCalledWith(expect.any(String), 'error');
    expect(chatState.value.openDock).not.toHaveBeenCalled();
  });
});
