/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn()
}));

vi.mock('./api', () => ({ api: apiMock }));

// Открытый ключ сервера (65 байт, base64url) — из примера RFC 8291.
const SERVER_KEY = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';

function decode(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function fakeSubscription(endpoint: string, key = decode(SERVER_KEY)) {
  return {
    endpoint,
    options: { applicationServerKey: key.buffer },
    getKey: (name: string) => (name === 'p256dh' ? new Uint8Array([1, 2, 3]).buffer : new Uint8Array([4, 5]).buffer),
    unsubscribe: vi.fn().mockResolvedValue(true)
  };
}

function setupBrowser({ secure = true, permission = 'granted', existing = null as ReturnType<typeof fakeSubscription> | null } = {}) {
  const pushManager = {
    getSubscription: vi.fn().mockResolvedValue(existing),
    subscribe: vi.fn().mockImplementation(async () => fakeSubscription('https://fcm.googleapis.com/fcm/send/new'))
  };
  const registration = { pushManager };
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: secure });
  Object.defineProperty(window, 'PushManager', { configurable: true, value: function PushManager() {} });
  Object.defineProperty(window, 'Notification', { configurable: true, value: { permission } });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: vi.fn().mockResolvedValue(registration),
      ready: Promise.resolve(registration),
      getRegistration: vi.fn().mockResolvedValue(registration)
    }
  });
  return pushManager;
}

beforeEach(() => {
  vi.resetModules();
  apiMock.get.mockResolvedValue({ data: { publicKey: SERVER_KEY } });
  apiMock.post.mockResolvedValue({});
  apiMock.delete.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('webPush', () => {
  it('subscribes with the server key and saves the subscription', async () => {
    const pushManager = setupBrowser();
    const { enableWebPush, isWebPushActive } = await import('./webPush');

    expect(await enableWebPush()).toBe(true);
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/chat-sw.js', { scope: '/' });
    expect(pushManager.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: decode(SERVER_KEY) });
    expect(apiMock.post).toHaveBeenCalledWith('/api/chat/push/subscriptions', {
      endpoint: 'https://fcm.googleapis.com/fcm/send/new',
      keys: { p256dh: 'AQID', auth: 'BAU' }
    });
    expect(isWebPushActive()).toBe(true);
  });

  it('reuses a subscription made with the same key and replaces one made with another key', async () => {
    let pushManager = setupBrowser({ existing: fakeSubscription('https://fcm.googleapis.com/fcm/send/same') });
    let module = await import('./webPush');
    await module.enableWebPush();
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(apiMock.post.mock.calls[0][1].endpoint).toBe('https://fcm.googleapis.com/fcm/send/same');

    vi.resetModules();
    apiMock.post.mockClear();
    const stale = fakeSubscription('https://fcm.googleapis.com/fcm/send/stale', new Uint8Array(65).fill(7));
    pushManager = setupBrowser({ existing: stale });
    module = await import('./webPush');
    await module.enableWebPush();
    expect(stale.unsubscribe).toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalled();
    expect(apiMock.post.mock.calls[0][1].endpoint).toBe('https://fcm.googleapis.com/fcm/send/new');
  });

  it('does nothing without HTTPS or without permission', async () => {
    let pushManager = setupBrowser({ secure: false });
    let module = await import('./webPush');
    expect(await module.enableWebPush()).toBe(false);
    expect(pushManager.subscribe).not.toHaveBeenCalled();

    vi.resetModules();
    pushManager = setupBrowser({ permission: 'default' });
    module = await import('./webPush');
    expect(await module.enableWebPush()).toBe(false);
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('unsubscribes and tells the server, but not on logout', async () => {
    const existing = fakeSubscription('https://fcm.googleapis.com/fcm/send/mine');
    setupBrowser({ existing });
    const { disableWebPush } = await import('./webPush');

    await disableWebPush();
    expect(apiMock.delete).toHaveBeenCalledWith('/api/chat/push/subscriptions', { data: { endpoint: 'https://fcm.googleapis.com/fcm/send/mine' } });
    expect(existing.unsubscribe).toHaveBeenCalledTimes(1);

    apiMock.delete.mockClear();
    await disableWebPush({ notifyServer: false });
    expect(apiMock.delete).not.toHaveBeenCalled();
    expect(existing.unsubscribe).toHaveBeenCalledTimes(2);
  });
});
