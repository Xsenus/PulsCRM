import { expect, test, type Page } from '@playwright/test';
import { currentUser, expectNoDocumentHorizontalOverflow, fulfillJson, setupAuthenticatedSession } from './helpers';

const now = Date.now();
const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();

const participants = [
  { userId: currentUser.id, displayName: currentUser.fullName, role: 0, isInactive: false, lastReadMessageId: 3 },
  { userId: 2, displayName: 'Петрова Анна Сергеевна', role: 0, isInactive: false, lastReadMessageId: 4 }
];

const pngPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const messages = [
  { id: 1, conversationId: 10, kind: 0, senderUserId: 2, senderName: 'Петрова Анна Сергеевна', text: 'Добрый день! Посмотрите, пожалуйста, отчет по лицензиям.', createdAtUtc: iso(70), isDeleted: false, attachments: [], reactions: [] },
  { id: 2, conversationId: 10, kind: 0, senderUserId: 2, senderName: 'Петрова Анна Сергеевна', text: null, createdAtUtc: iso(69), isDeleted: false, attachments: [
    { id: 501, conversationId: 10, messageId: 2, fileName: 'скриншот.png', contentType: 'image/png', length: 2048, isImage: true, uploadedAtUtc: iso(69) },
    { id: 502, conversationId: 10, messageId: 2, fileName: 'Отчет за октябрь.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', length: 48213, isImage: false, uploadedAtUtc: iso(69) }
  ], reactions: [] },
  { id: 3, conversationId: 10, kind: 0, senderUserId: currentUser.id, senderName: currentUser.fullName, text: 'Спасибо, сейчас гляну 👍', createdAtUtc: iso(40), isDeleted: false, attachments: [], reactions: [{ emoji: '❤️', count: 1, reactedByMe: false, userIds: [2] }],
    replyTo: { id: 1, senderUserId: 2, senderName: 'Петрова Анна Сергеевна', text: 'Добрый день! Посмотрите, пожалуйста, отчет по лицензиям.', isDeleted: false, attachmentCount: 0 } },
  { id: 4, conversationId: 10, kind: 0, senderUserId: 2, senderName: 'Петрова Анна Сергеевна', text: 'Ссылка на карточку: https://example.test/organizations/42', createdAtUtc: iso(5), isDeleted: false, attachments: [], reactions: [] }
];

const conversations = [
  { id: 10, kind: 0, title: 'Петрова Анна Сергеевна', peerUserId: 2, myRole: 0, isMuted: false, isPinned: true, isArchived: false, unreadCount: 1, myLastReadMessageId: 3,
    createdAtUtc: iso(1000), lastMessageAtUtc: iso(5), lastMessage: messages[3], participants },
  { id: 11, kind: 1, title: 'Отдел продаж', icon: '📈', myRole: 2, isMuted: false, isPinned: false, isArchived: false, unreadCount: 3, myLastReadMessageId: 0,
    createdAtUtc: iso(2000), lastMessageAtUtc: iso(30),
    lastMessage: { id: 9, conversationId: 11, kind: 0, senderUserId: 3, senderName: 'Иванов Олег', text: 'Планерка в 15:00', createdAtUtc: iso(30), isDeleted: false, attachments: [], reactions: [] },
    participants: [...participants, { userId: 3, displayName: 'Иванов Олег', role: 1, isInactive: false, lastReadMessageId: 9 }] },
  { id: 12, kind: 0, title: 'Смирнов Дмитрий', peerUserId: 4, myRole: 0, isMuted: true, isPinned: false, isArchived: false, unreadCount: 0, myLastReadMessageId: 0,
    createdAtUtc: iso(3000), lastMessageAtUtc: iso(60 * 26),
    lastMessage: { id: 7, conversationId: 12, kind: 0, senderUserId: currentUser.id, senderName: currentUser.fullName, text: 'До завтра!', createdAtUtc: iso(60 * 26), isDeleted: false, attachments: [], reactions: [] },
    participants: [participants[0], { userId: 4, displayName: 'Смирнов Дмитрий', role: 0, isInactive: false, lastReadMessageId: 7 }] }
];

/** Что сохранялось в серверное состояние окна чата — по странице теста. */
const dockSavesByPage = new WeakMap<Page, unknown[]>();

async function mockChat(page: Page) {
  const sent: unknown[] = [];
  await setupAuthenticatedSession(page);
  await page.route(/\/hubs\/chat/, (route) => route.fulfill({ status: 503, body: '' }));
  await page.route(/\/api\/chat\/status$/, (route) => fulfillJson(route, { enabled: true, currentUserId: currentUser.id, maxAttachmentBytes: 26214400, maxAttachmentsPerMessage: 10, maxMessageLength: 8000 }));
  await page.route(/\/api\/chat\/settings$/, (route) => fulfillJson(route, { notificationsEnabled: true, soundEnabled: true, soundName: 'chime', soundVolume: 70, showMessagePreview: true }));
  await page.route(/\/api\/chat\/conversations(\?.*)?$/, (route) => fulfillJson(route, conversations));
  await page.route(/\/api\/chat\/conversations\/10\/messages(\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      sent.push(body);
      await fulfillJson(route, { id: 100, conversationId: 10, kind: 0, senderUserId: currentUser.id, senderName: currentUser.fullName, text: body.text, clientMessageId: body.clientMessageId, createdAtUtc: new Date().toISOString(), isDeleted: false, attachments: [], reactions: [] });
      return;
    }

    await fulfillJson(route, { items: messages, hasMoreBefore: false });
  });
  await page.route(/\/api\/chat\/conversations\/\d+\/read$/, (route) => route.fulfill({ status: 204 }));
  let dockState: unknown = { open: false, conversationId: null, width: null, height: null };
  const dockSaves: unknown[] = [];
  await page.route(/\/api\/chat\/dock$/, async (route) => {
    if (route.request().method() === 'PUT') {
      dockState = route.request().postDataJSON();
      dockSaves.push(dockState);
    }

    await fulfillJson(route, dockState);
  });
  dockSavesByPage.set(page, dockSaves);
  await page.route(/\/api\/chat\/attachments\/501(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: pngPixel }));
  return sent;
}

test('chat shows conversations, thread with attachments and sends a message', async ({ page }) => {
  const sent = await mockChat(page);
  await page.goto('/chat/10');

  await expect(page.getByRole('link', { name: /Чат/ })).toBeVisible();
  await expect(page.locator('.chat-conversation-item')).toHaveCount(3);
  await expect(page.locator('.chat-view-name')).toHaveText('Петрова Анна Сергеевна');
  await expect(page.locator('.chat-message')).toHaveCount(4);
  await expect(page.locator('.chat-image-thumb img')).toBeVisible();
  await expect(page.locator('.chat-file-card', { hasText: 'Отчет за октябрь.xlsx' })).toBeVisible();
  await expect(page.locator('.chat-bubble-reply')).toContainText('Петрова Анна Сергеевна');
  await expect(page.locator('.chat-bubble-text a')).toHaveAttribute('href', 'https://example.test/organizations/42');

  const textarea = page.getByLabel('Текст сообщения');
  await textarea.fill('Готово, отчет согласован');
  await textarea.press('Enter');

  await expect(page.locator('.chat-message.own', { hasText: 'Готово, отчет согласован' })).toBeVisible();
  expect(sent).toEqual([expect.objectContaining({ text: 'Готово, отчет согласован', attachmentIds: [] })]);
  expect(await expectNoDocumentHorizontalOverflow(page)).toBe(true);
});

test('chat on a phone shows either the list or the thread', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await mockChat(page);
  await page.goto('/chat');

  await expect(page.locator('.chat-conversation-item')).toHaveCount(3);
  await expect(page.locator('.chat-main')).toBeHidden();

  await page.locator('.chat-conversation-item', { hasText: 'Петрова' }).click();
  await expect(page).toHaveURL(/\/chat\/10$/);
  await expect(page.locator('.chat-sidebar')).toBeHidden();
  await expect(page.getByLabel('Текст сообщения')).toBeVisible();

  await page.getByRole('button', { name: 'К списку диалогов' }).click();
  await expect(page).toHaveURL(/\/chat$/);
  expect(await expectNoDocumentHorizontalOverflow(page)).toBe(true);
});

test('floating chat window lets you write without leaving the page', async ({ page }) => {
  const sent = await mockChat(page);
  await page.addInitScript(() => window.localStorage.removeItem('puls-chat-dock'));
  await page.route(/\/api\/employees(\?.*)?$/, (route) => fulfillJson(route, { totalCount: 0, items: [] }));
  await page.goto('/employees');

  const fab = page.getByRole('button', { name: /Открыть чат/ });
  await expect(fab).toBeVisible();
  await expect(fab.locator('.chat-dock-fab-badge')).toHaveText('4');
  await fab.click();

  const dock = page.getByRole('region', { name: 'Окно чата' });
  await expect(dock.locator('.chat-conversation-item')).toHaveCount(3);
  await dock.locator('.chat-conversation-item', { hasText: 'Петрова' }).click();
  await expect(dock.locator('.chat-message')).toHaveCount(4);

  const textarea = dock.getByLabel('Текст сообщения');
  await textarea.fill('Пишу из окна');
  await textarea.press('Enter');
  await expect(dock.locator('.chat-message.own', { hasText: 'Пишу из окна' })).toBeVisible();
  expect(sent).toEqual([expect.objectContaining({ text: 'Пишу из окна' })]);
  await expect(page).toHaveURL(/\/employees$/);

  await dock.getByRole('button', { name: 'Свернуть чат' }).click();
  await expect(dock).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: /Открыть чат/ })).toBeVisible();

  await page.goto('/chat');
  await expect(page.getByRole('button', { name: /Открыть чат/ })).toBeHidden();
});

test('floating chat window can be resized and remembers size and open state', async ({ page }) => {
  await mockChat(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('dock-test-started')) {
      sessionStorage.setItem('dock-test-started', '1');
      window.localStorage.removeItem('puls-chat-dock');
    }
  });
  await page.route(/\/api\/employees(\?.*)?$/, (route) => fulfillJson(route, { totalCount: 0, items: [] }));
  await page.goto('/employees');
  await page.getByRole('button', { name: /Открыть чат/ }).click();

  const dock = page.getByRole('region', { name: 'Окно чата' });
  const width = async () => Math.round((await page.getByRole('region', { name: 'Окно чата' }).boundingBox())?.width ?? 0);
  // Окно появляется с короткой анимацией масштаба — ждем, пока она закончится.
  await expect.poll(width).toBe(390);
  const before = (await dock.boundingBox())!;

  const corner = page.getByRole('separator', { name: 'Изменить размер окна чата' });
  const handle = (await corner.boundingBox())!;
  await page.mouse.move(handle.x + 5, handle.y + 5);
  await page.mouse.down();
  await page.mouse.move(handle.x - 145, handle.y - 95, { steps: 5 });
  await page.mouse.up();

  const after = (await dock.boundingBox())!;
  expect(Math.round(after.width)).toBe(540);
  expect(Math.round(after.height)).toBe(700);
  expect(Math.round(after.x + after.width)).toBe(Math.round(before.x + before.width));

  await page.reload();
  await expect.poll(width).toBe(540);
  const restored = (await page.getByRole('region', { name: 'Окно чата' }).boundingBox())!;
  expect(Math.round(restored.height)).toBe(700);

  await page.getByRole('button', { name: 'Свернуть чат' }).click();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Окно чата' })).toBeHidden();
  await page.getByRole('button', { name: /Открыть чат/ }).click();
  await expect.poll(width).toBe(540);
});

test('floating chat window state is stored on the server and follows the user to another computer', async ({ page }) => {
  await mockChat(page);
  const dockSaves = dockSavesByPage.get(page)!;
  await page.setViewportSize({ width: 1440, height: 900 });
  // Каждая загрузка — как будто новый компьютер: локальной копии нет, все берется с сервера.
  await page.addInitScript(() => window.localStorage.removeItem('puls-chat-dock'));
  await page.route(/\/api\/employees(\?.*)?$/, (route) => fulfillJson(route, { totalCount: 0, items: [] }));
  await page.goto('/employees');

  await page.getByRole('button', { name: /Открыть чат/ }).click();
  await page.getByRole('region', { name: 'Окно чата' }).locator('.chat-conversation-item', { hasText: 'Петрова' }).click();
  await expect.poll(() => dockSaves.at(-1)).toEqual({ open: true, conversationId: 10, width: null, height: null });

  const corner = page.getByRole('separator', { name: 'Изменить размер окна чата' });
  const handle = (await corner.boundingBox())!;
  await page.mouse.move(handle.x + 5, handle.y + 5);
  await page.mouse.down();
  await page.mouse.move(handle.x - 95, handle.y - 45, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => dockSaves.at(-1)).toEqual({ open: true, conversationId: 10, width: 490, height: 650 });
  const savesAfterResize = dockSaves.length;
  expect(savesAfterResize).toBeLessThanOrEqual(3);

  await page.reload();
  const dock = page.getByRole('region', { name: 'Окно чата' });
  await expect(dock.locator('.chat-view-name')).toHaveText('Петрова Анна Сергеевна');
  await expect.poll(async () => Math.round((await dock.boundingBox())?.width ?? 0)).toBe(490);
  await expect.poll(async () => Math.round((await dock.boundingBox())?.height ?? 0)).toBe(650);

  await dock.getByRole('button', { name: 'Свернуть чат' }).click();
  await expect.poll(() => dockSaves.at(-1)).toEqual({ open: false, conversationId: 10, width: 490, height: 650 });
  await page.reload();
  await expect(page.getByRole('button', { name: /Открыть чат/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Окно чата' })).toBeHidden();
});

test('links to CRM objects show a card and the employee card can start a chat', async ({ page, baseURL }) => {
  await mockChat(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => window.localStorage.removeItem('puls-chat-dock'));

  const orgLink = `${baseURL}/organizations/42/edit`;
  await page.route(/\/api\/chat\/conversations\/10\/messages(\?.*)?$/, (route) => fulfillJson(route, {
    items: [{ id: 1, conversationId: 10, kind: 0, senderUserId: 2, senderName: 'Петрова Анна Сергеевна', text: `Посмотри карточку ${orgLink} пожалуйста`, createdAtUtc: iso(5), isDeleted: false, attachments: [], reactions: [] }],
    hasMoreBefore: false
  }));
  await page.route(/\/api\/organizations\/42$/, (route) => fulfillJson(route, { id: 42, name: 'ООО «Ромашка»', inn: '7701234567', raion: 'Центральный' }));

  await page.goto('/chat/10');
  const preview = page.locator('.chat-link-preview');
  await expect(preview).toContainText('Организация #42');
  await expect(preview).toContainText('ООО «Ромашка»');
  await preview.click();
  await expect(page).toHaveURL(/\/organizations\/42\/edit$/);

  await page.route(/\/api\/employees\/lookups(\?.*)?$/, (route) => fulfillJson(route, { groups: [{ id: 5, name: 'Бухгалтерия' }], rules: [], privacyGroups: [] }));
  await page.route(/\/api\/employees\/2$/, (route) => fulfillJson(route, { id: 2, login: 'petrova', fullName: 'Петрова Анна Сергеевна', userGroupId: 5, userGroup: 'Бухгалтерия' }));
  let directRequest: unknown = null;
  await page.route(/\/api\/chat\/conversations\/direct$/, async (route) => {
    directRequest = route.request().postDataJSON();
    await fulfillJson(route, conversations[0]);
  });

  await page.goto('/employees/2/edit');
  await page.getByRole('button', { name: /Написать/ }).click();
  await expect.poll(() => directRequest).toEqual({ userId: 2 });
  const dock = page.getByRole('region', { name: 'Окно чата' });
  await expect(dock.locator('.chat-view-name')).toHaveText('Петрова Анна Сергеевна');
  await expect(page).toHaveURL(/\/employees\/2\/edit$/);
});

test('large images are uploaded with a thumbnail and the feed loads the thumbnail', async ({ page }) => {
  await mockChat(page);
  const uploads: { body: string; length: number }[] = [];
  await page.route(/\/api\/chat\/conversations\/10\/attachments$/, async (route) => {
    const buffer = route.request().postDataBuffer() ?? Buffer.alloc(0);
    uploads.push({ body: buffer.toString('latin1'), length: buffer.length });
    await fulfillJson(route, { id: 601, conversationId: 10, fileName: 'фото.png', contentType: 'image/png', length: 1, isImage: true, hasThumbnail: true, width: 2000, height: 1500, uploadedAtUtc: new Date().toISOString() });
  });
  const imageRequests: string[] = [];
  await page.route(/\/api\/chat\/attachments\/701(\?.*)?$/, (route) => {
    imageRequests.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'image/png', body: pngPixel });
  });
  await page.route(/\/api\/chat\/conversations\/10\/messages(\?.*)?$/, (route) => fulfillJson(route, {
    items: [{ id: 70, conversationId: 10, kind: 0, senderUserId: 2, senderName: 'Петрова Анна Сергеевна', text: null, createdAtUtc: iso(3), isDeleted: false, reactions: [], attachments: [
      { id: 701, conversationId: 10, messageId: 70, fileName: 'план.jpg', contentType: 'image/jpeg', length: 5_000_000, isImage: true, hasThumbnail: true, width: 1600, height: 1200, uploadedAtUtc: iso(3) }
    ] }],
    hasMoreBefore: false
  }));

  await page.goto('/chat/10');
  await expect(page.locator('.chat-image-thumb img')).toBeVisible();
  expect(imageRequests.some((url) => url.includes('thumbnail=true'))).toBe(true);
  expect(imageRequests.some((url) => !url.includes('thumbnail=true'))).toBe(false);

  // Шумная картинка 2000×1500: PNG получается в несколько мегабайт.
  const pngBase64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2000;
    canvas.height = 1500;
    const context = canvas.getContext('2d')!;
    const data = context.createImageData(2000, 1500);
    for (let index = 0; index < data.data.length; index += 1) {
      data.data[index] = (index * 7919) % 251;
    }
    context.putImageData(data, 0, 0);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const original = Buffer.from(pngBase64, 'base64');
  await page.locator('input[type="file"]').setInputFiles({ name: 'фото.png', mimeType: 'image/png', buffer: original });

  await expect.poll(() => uploads.length).toBe(1);
  const { body, length } = uploads[0];
  expect(body).toContain('name="thumbnail"');
  expect(body).toMatch(/name="width"\r\n\r\n2000\r\n/);
  expect(body).toMatch(/name="height"\r\n\r\n1500\r\n/);
  // Копия добавляет к запросу заметно меньше оригинала.
  expect(length - original.length).toBeLessThan(512 * 1024);
  await expect(page.locator('.chat-upload')).toHaveCount(1);
});

test('pinned message is shown above the feed and jumps to the message', async ({ page }) => {
  await mockChat(page);
  const pinnedConversations = conversations.map((item) => item.id === 10 ? { ...item, pinnedMessage: messages[0], canPinMessages: true } : item);
  await page.route(/\/api\/chat\/conversations(\?.*)?$/, (route) => fulfillJson(route, pinnedConversations));
  const pinRequests: unknown[] = [];
  await page.route(/\/api\/chat\/conversations\/10\/pinned-message$/, async (route) => {
    pinRequests.push(route.request().postDataJSON());
    await fulfillJson(route, { ...pinnedConversations[0], pinnedMessage: null });
  });

  await page.goto('/chat/10');
  const bar = page.locator('.chat-pinned-bar');
  await expect(bar).toContainText('Закрепленное сообщение');
  await expect(bar).toContainText('отчет по лицензиям');

  await bar.locator('.chat-pinned-body').click();
  await expect(page.locator('[data-message-id="1"]')).toHaveClass(/chat-message-highlight/);

  await page.getByRole('button', { name: 'Открепить сообщение' }).click();
  await expect(bar).toHaveCount(0);
  expect(pinRequests).toEqual([{ messageId: null }]);
  expect(await expectNoDocumentHorizontalOverflow(page)).toBe(true);
});

test('message search finds messages across chats and opens the conversation on the message', async ({ page }) => {
  await mockChat(page);
  const queries: string[] = [];
  await page.route(/\/api\/chat\/search(\?.*)?$/, async (route) => {
    queries.push(new URL(route.request().url()).searchParams.get('q') ?? '');
    await fulfillJson(route, [
      { conversationId: 10, conversationTitle: 'Петрова Анна Сергеевна', conversationKind: 0, peerUserId: 2, message: messages[0] }
    ]);
  });

  await page.goto('/chat');
  await page.getByLabel('Поиск по чатам и сообщениям').fill('лицензиям');
  const result = page.locator('.chat-search-result');
  await expect(result).toHaveCount(1);
  await expect(result.locator('mark')).toHaveText('лицензиям');
  expect(queries).toEqual(['лицензиям']);

  await result.click();
  await expect(page).toHaveURL(/\/chat\/10\?message=1$/);
  await expect(page.locator('[data-message-id="1"]')).toHaveClass(/chat-message-highlight/);
  expect(await expectNoDocumentHorizontalOverflow(page)).toBe(true);
});

test('a message can be forwarded to another chat', async ({ page }) => {
  await mockChat(page);
  const forwards: unknown[] = [];
  await page.route(/\/api\/chat\/messages\/1\/forward$/, async (route) => {
    forwards.push(route.request().postDataJSON());
    await fulfillJson(route, [{ ...messages[0], id: 200, conversationId: 11, senderUserId: currentUser.id, senderName: currentUser.fullName, forwardedFrom: { userId: 2, name: 'Петрова Анна Сергеевна' } }]);
  });

  await page.goto('/chat/10');
  const first = page.locator('[data-message-id="1"]');
  await first.hover();
  await first.getByRole('button', { name: 'Еще' }).click();
  await first.getByRole('menuitem', { name: 'Переслать' }).click();

  const dialog = page.getByRole('dialog', { name: 'Переслать сообщение' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Найти чат').fill('продаж');
  await dialog.getByRole('option', { name: /Отдел продаж/ }).click();
  await dialog.getByRole('button', { name: 'Переслать (1)' }).click();

  await expect(dialog).toHaveCount(0);
  expect(forwards).toEqual([{ conversationIds: [11] }]);
});
