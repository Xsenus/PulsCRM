/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHAT_OPEN_EVENT, getDesktopNotificationStatus, requestDesktopNotificationPermission, showDesktopNotification } from './desktopNotifications';

const created: Array<{ title: string; options: NotificationOptions; instance: any }> = [];

function installNotification(permission: NotificationPermission, secure = true) {
  class FakeNotification {
    static permission = permission;
    static requestPermission = vi.fn(async () => 'granted' as NotificationPermission);
    onclick: (() => void) | null = null;
    close = vi.fn();
    constructor(public title: string, public options: NotificationOptions) {
      created.push({ title, options, instance: this });
    }
  }

  Object.defineProperty(window, 'Notification', { configurable: true, writable: true, value: FakeNotification });
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: secure });
  return FakeNotification;
}

afterEach(() => {
  created.length = 0;
  delete (window as any).Notification;
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
});

describe('desktopNotifications', () => {
  it('reports why notifications are unavailable', () => {
    delete (window as any).Notification;
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    expect(getDesktopNotificationStatus()).toBe('insecure');

    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    expect(getDesktopNotificationStatus()).toBe('unsupported');

    installNotification('granted', false);
    expect(getDesktopNotificationStatus()).toBe('insecure');

    installNotification('denied');
    expect(getDesktopNotificationStatus()).toBe('denied');
  });

  it('asks permission only when it can be granted', async () => {
    const Fake = installNotification('default');
    expect(await requestDesktopNotificationPermission()).toBe('granted');
    expect(Fake.requestPermission).toHaveBeenCalledTimes(1);

    const Denied = installNotification('denied');
    expect(await requestDesktopNotificationPermission()).toBe('denied');
    expect(Denied.requestPermission).not.toHaveBeenCalled();
  });

  it('shows a silent notification per conversation and opens it on click', () => {
    installNotification('granted');
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => undefined);
    const opened: number[] = [];
    const listener = (event: Event) => opened.push((event as CustomEvent<number>).detail);
    window.addEventListener(CHAT_OPEN_EVENT, listener);

    showDesktopNotification({ title: 'Борис', body: 'Привет', conversationId: 10 });
    expect(created).toHaveLength(1);
    expect(created[0].title).toBe('Борис');
    expect(created[0].options).toMatchObject({ body: 'Привет', tag: 'puls-chat-10', silent: true });

    created[0].instance.onclick();
    expect(focus).toHaveBeenCalled();
    expect(opened).toEqual([10]);
    expect(created[0].instance.close).toHaveBeenCalled();

    window.removeEventListener(CHAT_OPEN_EVENT, listener);
    focus.mockRestore();
  });

  it('does nothing without permission', () => {
    installNotification('default');
    expect(showDesktopNotification({ title: 'x', body: 'y', conversationId: 1 })).toBeNull();
    expect(created).toHaveLength(0);
  });
});
