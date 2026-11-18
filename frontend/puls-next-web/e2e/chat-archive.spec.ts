import { expect, test, type Page } from '@playwright/test';
import { currentUser, fulfillJson, setupAuthenticatedSession } from './helpers';

const now = Date.now();

function message(id: number, conversationId: number, senderUserId: number) {
  return {
    id, conversationId, kind: 0, senderUserId, senderName: 'Собеседник', text: `Сообщение ${id}`,
    createdAtUtc: new Date(now - (100 - id) * 60_000).toISOString(), isDeleted: false, attachments: [], reactions: []
  };
}

function conversation(id: number, title: string, patch: Record<string, unknown> = {}) {
  const last = message(id * 10, id, 2);
  return {
    id, kind: 0, title, peerUserId: 2, myRole: 0, isMuted: false, isPinned: false, isArchived: false,
    unreadCount: 0, myLastReadMessageId: last.id,
    createdAtUtc: new Date(now - 10_000_000).toISOString(), lastMessageAtUtc: last.createdAtUtc, lastMessage: last,
    participants: [
      { userId: currentUser.id, displayName: currentUser.fullName, role: 0, isInactive: false, lastReadMessageId: last.id },
      { userId: 2, displayName: 'Петрова Анна', role: 0, isInactive: false, lastReadMessageId: last.id }
    ],
    ...patch
  };
}

async function mockChat(page: Page) {
  const state = {
    conversations: [
      conversation(10, 'Петрова Анна'),
      conversation(20, 'Отдел продаж', { kind: 1, peerUserId: null, myRole: 2, icon: '💼' }),
      conversation(30, 'Старый проект', { kind: 1, peerUserId: null, isArchived: true })
    ],
    deleted: [] as number[]
  };

  await setupAuthenticatedSession(page);
  await page.addInitScript(() => window.localStorage.removeItem('puls-chat-dock'));
  await page.route(/\/hubs\/chat/, (route) => route.fulfill({ status: 503, body: '' }));
  await page.route(/\/api\/chat\/status$/, (route) => fulfillJson(route, { enabled: true, currentUserId: currentUser.id, maxAttachmentBytes: 26214400, maxAttachmentsPerMessage: 10, maxMessageLength: 8000 }));
  await page.route(/\/api\/chat\/settings$/, (route) => fulfillJson(route, { notificationsEnabled: true, soundEnabled: false, soundName: 'chime', soundVolume: 70, showMessagePreview: true }));
  await page.route(/\/api\/chat\/dock$/, (route) => fulfillJson(route, { open: false, conversationId: null, width: null, height: null }));
  await page.route(/\/api\/chat\/conversations(\?.*)?$/, (route) => {
    const includeArchived = new URL(route.request().url()).searchParams.get('includeArchived') === 'true';
    return fulfillJson(route, state.conversations.filter((item) => includeArchived || !item.isArchived));
  });
  await page.route(/\/api\/chat\/conversations\/\d+$/, async (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/')[4]);
    if (route.request().method() === 'DELETE') {
      state.deleted.push(id);
      state.conversations = state.conversations.filter((item) => item.id !== id);
      return route.fulfill({ status: 204 });
    }

    return fulfillJson(route, state.conversations.find((item) => item.id === id));
  });
  await page.route(/\/api\/chat\/conversations\/\d+\/messages(\?.*)?$/, (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/')[4]);
    return fulfillJson(route, { items: [message(id * 10, id, 2)], hasMoreBefore: false });
  });
  await page.route(/\/api\/chat\/conversations\/\d+\/preferences$/, async (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/')[4]);
    const item = state.conversations.find((entry) => entry.id === id)!;
    Object.assign(item, route.request().postDataJSON());
    await fulfillJson(route, item);
  });
  await page.route(/\/api\/chat\/(delivered|conversations\/\d+\/read)$/, (route) => route.fulfill({ status: 204 }));
  await page.route(/\/api\/colleagues$/, (route) => fulfillJson(route, []));
  await page.route(/\/api\/colleagues\/2$/, (route) => fulfillJson(route, {
    id: 2, fullName: 'Петрова Анна Сергеевна', position: 'Главный бухгалтер', department: 'Бухгалтерия', email: 'petrova@example.test', phone: null,
    internalPhone: '201', birthdayMonth: null, birthdayDay: null, hasPhoto: false, isMale: false, status: null
  }));
  await page.route(/\/api\/employees(\?.*)?$/, (route) => fulfillJson(route, { totalCount: 0, items: [] }));
  return state;
}

test('archived chats open from the Archive link and return to the list', async ({ page }) => {
  await mockChat(page);
  await page.goto('/chat');

  const sidebar = page.getByRole('complementary', { name: 'Диалоги' });
  await expect(sidebar.locator('.chat-conversation-item')).toHaveCount(2);
  const archiveLink = sidebar.getByRole('button', { name: /Архив/ });
  await expect(archiveLink).toContainText('1');
  await archiveLink.click();

  await expect(sidebar.locator('.chat-archive-head')).toContainText('Архив');
  await expect(sidebar.locator('.chat-conversation-item')).toHaveText([/Старый проект/]);
  await sidebar.locator('.chat-conversation-item').click();
  await expect(page).toHaveURL(/\/chat\/30$/);
  await expect(page.locator('.chat-view-name')).toHaveText('Старый проект');

  await page.getByRole('button', { name: 'Вернуть из архива' }).click();
  await expect(page.locator('.toast', { hasText: 'Диалог возвращен из архива.' })).toBeVisible();
  // Архив опустел — снова виден основной список, уже с вернувшимся чатом.
  await expect(sidebar.locator('.chat-conversation-item')).toHaveCount(3);
  await expect(sidebar.getByRole('button', { name: /Архив/ })).toHaveCount(0);
});

test('a direct chat shows the colleague card, the group owner can delete the chat for everyone', async ({ page }) => {
  const state = await mockChat(page);
  await page.goto('/chat/10');

  await page.getByRole('button', { name: 'О чате', exact: true }).click();
  const card = page.getByRole('dialog', { name: 'О собеседнике' });
  await expect(card).toContainText('Петрова Анна Сергеевна');
  await expect(card).toContainText('Главный бухгалтер');
  await expect(card).toContainText('petrova@example.test');
  // Уже в диалоге — кнопка «Написать» лишняя.
  await expect(card.getByRole('button', { name: /Написать/ })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.goto('/chat/20');
  await page.getByRole('button', { name: 'О чате', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'О групповом чате' });
  await dialog.getByRole('button', { name: 'Удалить чат' }).click();
  const confirm = dialog.getByRole('alertdialog', { name: 'Удалить чат' });
  await expect(confirm).toContainText('История сохранится');
  await confirm.getByRole('button', { name: 'Удалить для всех' }).click();

  await expect.poll(() => state.deleted).toEqual([20]);
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByRole('complementary', { name: 'Диалоги' }).locator('.chat-conversation-item', { hasText: 'Отдел продаж' })).toHaveCount(0);

  // Короткий тост — в одну строку.
  const toast = page.locator('.toast', { hasText: 'Чат удален.' });
  await expect(toast).toBeVisible();
  const lines = await toast.locator('strong').evaluate((node) => Math.round(node.getBoundingClientRect().height / parseFloat(getComputedStyle(node).lineHeight)));
  expect(lines).toBe(1);
});

test('toasts take the width of their text instead of wrapping early', async ({ page }) => {
  await mockChat(page);
  await page.goto('/chat');

  const sidebar = page.getByRole('complementary', { name: 'Диалоги' });
  await sidebar.locator('.chat-conversation-item', { hasText: 'Петрова Анна' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /В архив/ }).click();

  const toast = page.locator('.toast', { hasText: 'Диалог в архиве' });
  await expect(toast).toBeVisible();
  const lines = await toast.locator('strong').evaluate((node) => Math.round(node.getBoundingClientRect().height / parseFloat(getComputedStyle(node).lineHeight)));
  expect(lines).toBe(1);
  // Тост прижат к правому краю.
  const box = (await toast.boundingBox())!;
  expect(Math.abs(page.viewportSize()!.width - 20 - (box.x + box.width))).toBeLessThan(2);
});
