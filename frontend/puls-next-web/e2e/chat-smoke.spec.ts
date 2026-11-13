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
