import { expect, test, type Page } from '@playwright/test';
import { currentUser, fulfillJson, setupAuthenticatedSession } from './helpers';

async function mockChat(page: Page) {
  await setupAuthenticatedSession(page);
  await page.addInitScript(() => window.localStorage.removeItem('puls-chat-dock'));
  await page.route(/\/hubs\/chat/, (route) => route.fulfill({ status: 503, body: '' }));
  await page.route(/\/api\/chat\/status$/, (route) => fulfillJson(route, { enabled: true, currentUserId: currentUser.id, maxAttachmentBytes: 26214400, maxAttachmentsPerMessage: 10, maxMessageLength: 8000 }));
  await page.route(/\/api\/chat\/settings$/, (route) => fulfillJson(route, { notificationsEnabled: true, soundEnabled: false, soundName: 'chime', soundVolume: 70, showMessagePreview: true, desktopNotificationsEnabled: false }));
  await page.route(/\/api\/chat\/dock$/, (route) => fulfillJson(route, { open: false, conversationId: null, width: null, height: null }));
  await page.route(/\/api\/chat\/conversations(\?.*)?$/, (route) => fulfillJson(route, []));
  await page.route(/\/api\/colleagues$/, (route) => fulfillJson(route, []));
  await page.route(/\/api\/dashboard$/, (route) => fulfillJson(route, { employees: 0, organizations: 0, activeCampaigns: 0, queueDepth: 0, sentLast24Hours: 0, failedLast24Hours: 0 }));
}

test('without HTTPS the chat settings explain how to allow system notifications', async ({ page }) => {
  await mockChat(page);
  // Как на http://192.168.0.16:8080: браузер не считает адрес безопасным.
  await page.addInitScript(() => Object.defineProperty(window, 'isSecureContext', { configurable: true, get: () => false }));
  await page.goto('/chat');

  await page.getByRole('button', { name: 'Оповещения и звук' }).click();
  const dialog = page.getByRole('dialog', { name: 'Оповещения чата' });
  await expect(dialog.getByRole('checkbox', { name: /Системные уведомления/ })).toBeDisabled();
  await expect(dialog.locator('.notify-status')).toHaveText('Нужна настройка');
  await expect(dialog.locator('.notify-steps li')).toHaveCount(3);

  // Главный путь — файл настройки для Windows с адресом этой CRM для Chrome, Edge и Яндекса.
  const origin = new URL(page.url()).origin;
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Скачать настройку для Windows' }).click()
  ]);
  expect(download.suggestedFilename()).toBe('puls-crm-uvedomleniya.reg');
  const bytes = await (await download.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks));
  expect([bytes[0], bytes[1]]).toEqual([0xff, 0xfe]);
  const text = bytes.subarray(2).toString('utf16le');
  expect(text.startsWith('Windows Registry Editor Version 5.00')).toBe(true);
  for (const key of ['Google\\Chrome', 'Microsoft\\Edge', 'YandexBrowser']) {
    expect(text).toContain(`[HKEY_CURRENT_USER\\Software\\Policies\\${key}\\OverrideSecurityRestrictionsOnInsecureOrigin]`);
  }
  expect(text).toContain(`"1"="${origin}"`);

  // Запасной путь — вручную, две строки с кнопками «Копировать»; заметка для администратора (пользователь демо — админ).
  await dialog.getByRole('button', { name: /Настроить вручную/ }).click();
  await expect(dialog.locator('.notify-copy-row code')).toHaveText(['chrome://flags/#unsafely-treat-insecure-origin-as-secure', origin]);
  await expect(dialog.getByRole('button', { name: 'Копировать' })).toHaveCount(2);
  await expect(dialog.locator('.notify-admin-note')).toContainText('OverrideSecurityRestrictionsOnInsecureOrigin');
});

test('the chat service worker shows a push notification only when CRM is not on screen', async ({ page, context, baseURL }) => {
  await context.grantPermissions(['notifications'], { origin: baseURL });
  await mockChat(page);
  await page.goto('/');

  const cdp = await context.newCDPSession(page);
  const registrationId = new Promise<string>((resolve) => {
    cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
      const registration = registrations.find((item: { scopeURL: string; isDeleted: boolean }) => item.scopeURL.startsWith(baseURL!) && !item.isDeleted);
      if (registration) {
        resolve(registration.registrationId);
      }
    });
  });
  await cdp.send('ServiceWorker.enable');
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/chat-sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
  });
  const id = await registrationId;
  const worker = context.serviceWorkers().find((item) => item.url().endsWith('/chat-sw.js')) ?? await context.waitForEvent('serviceworker');
  const notifications = () => worker.evaluate(async () => (await (self as unknown as ServiceWorkerGlobalScope).registration.getNotifications())
    .map((item) => ({ title: item.title, body: item.body, tag: item.tag, data: item.data })));
  const push = (data: object) => cdp.send('ServiceWorker.deliverPushMessage', { origin: baseURL!, registrationId: id, data: JSON.stringify(data) });

  // CRM открыта и на экране — уведомление покажет сама страница, сервис-воркер молчит.
  await page.bringToFront();
  await push({ title: 'Алиса', body: 'Привет', conversationId: 10, url: '/chat/10' });
  await page.waitForTimeout(500);
  expect(await notifications()).toEqual([]);

  // Вкладки CRM нет на экране — системное уведомление; новое в том же диалоге заменяет предыдущее.
  await page.goto('about:blank');
  // Ждем, пока сервис-воркер перестанет видеть вкладку CRM (под нагрузкой это занимает мгновение).
  await expect.poll(() => worker.evaluate(async () => (await (self as unknown as ServiceWorkerGlobalScope).clients.matchAll({ type: 'window', includeUncontrolled: true })).length)).toBe(0);
  await push({ title: 'Алиса', body: 'Привет', conversationId: 10, url: '/chat/10' });
  await push({ title: 'Алиса', body: 'Ты тут?', conversationId: 10, url: '/chat/10' });
  await expect.poll(notifications).toEqual([{ title: 'Алиса', body: 'Ты тут?', tag: 'puls-chat-10', data: { url: '/chat/10', conversationId: 10 } }]);
});
