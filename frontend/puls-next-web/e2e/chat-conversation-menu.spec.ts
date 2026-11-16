import { expect, test, type Page } from '@playwright/test';
import { currentUser, fulfillJson, setupAuthenticatedSession } from './helpers';

const now = Date.now();

function message(id: number, conversationId: number, senderUserId: number) {
  return {
    id, conversationId, kind: 0, senderUserId, senderName: 'Собеседник', text: `Сообщение ${id}`,
    createdAtUtc: new Date(now - (100 - id) * 60_000).toISOString(), isDeleted: false, attachments: [], reactions: []
  };
}

function conversation(id: number, title: string, peerUserId: number, unreadCount: number) {
  const last = message(id * 10, id, peerUserId);
  return {
    id, kind: 0, title, peerUserId, myRole: 0, isMuted: false, isPinned: false, isArchived: false,
    unreadCount, myLastReadMessageId: unreadCount > 0 ? last.id - unreadCount : last.id,
    createdAtUtc: new Date(now - 10_000_000).toISOString(), lastMessageAtUtc: last.createdAtUtc, lastMessage: last,
    participants: [
      { userId: currentUser.id, displayName: currentUser.fullName, role: 0, isInactive: false, lastReadMessageId: 0 },
      { userId: peerUserId, displayName: title, role: 0, isInactive: false, lastReadMessageId: last.id }
    ]
  };
}

async function mockChat(page: Page) {
  const state = {
    conversations: [conversation(10, 'Петрова Анна', 2, 3), conversation(11, 'Иванов Олег', 3, 0)],
    preferences: [] as { id: number; body: Record<string, boolean> }[],
    reads: [] as { id: number; messageId: number }[]
  };

  await setupAuthenticatedSession(page);
  await page.addInitScript(() => window.localStorage.removeItem('puls-chat-dock'));
  await page.route(/\/hubs\/chat/, (route) => route.fulfill({ status: 503, body: '' }));
  await page.route(/\/api\/chat\/status$/, (route) => fulfillJson(route, { enabled: true, currentUserId: currentUser.id, maxAttachmentBytes: 26214400, maxAttachmentsPerMessage: 10, maxMessageLength: 8000 }));
  await page.route(/\/api\/chat\/settings$/, (route) => fulfillJson(route, { notificationsEnabled: true, soundEnabled: false, soundName: 'chime', soundVolume: 70, showMessagePreview: true }));
  await page.route(/\/api\/chat\/dock$/, (route) => fulfillJson(route, { open: false, conversationId: null, width: null, height: null }));
  await page.route(/\/api\/chat\/conversations(\?.*)?$/, (route) => fulfillJson(route, state.conversations));
  await page.route(/\/api\/chat\/conversations\/\d+\/messages(\?.*)?$/, (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/')[4]);
    return fulfillJson(route, { items: [message(id * 10, id, id === 10 ? 2 : 3)], hasMoreBefore: false });
  });
  await page.route(/\/api\/chat\/conversations\/\d+\/preferences$/, async (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/')[4]);
    const body = route.request().postDataJSON() as Record<string, boolean>;
    state.preferences.push({ id, body });
    const item = state.conversations.find((entry) => entry.id === id)!;
    Object.assign(item, body);
    if (body.isArchived) {
      state.conversations = state.conversations.filter((entry) => entry.id !== id);
    }

    await fulfillJson(route, item);
  });
  await page.route(/\/api\/chat\/conversations\/\d+\/read$/, (route) => {
    state.reads.push({ id: Number(new URL(route.request().url()).pathname.split('/')[4]), messageId: route.request().postDataJSON()?.messageId });
    return route.fulfill({ status: 204 });
  });
  await page.route(/\/api\/chat\/delivered$/, (route) => route.fulfill({ status: 204 }));
  await page.route(/\/api\/employees(\?.*)?$/, (route) => fulfillJson(route, { totalCount: 0, items: [] }));
  return state;
}

test('right click on a chat opens its settings menu', async ({ page }) => {
  const state = await mockChat(page);
  await page.goto('/chat');

  const sidebar = page.getByRole('complementary', { name: 'Диалоги' });
  const anna = sidebar.locator('.chat-conversation-item', { hasText: 'Петрова Анна' });
  await anna.click({ button: 'right' });

  const menu = page.getByRole('menu', { name: 'Действия с чатом «Петрова Анна»' });
  await expect(menu.locator('.chat-menu-label')).toHaveText(['Закрепить вверху', 'Без звука', 'Отметить прочитанным', 'О собеседнике', 'В архив']);
  // Группы: настройки диалога | карточка | архив.
  await expect(menu.getByRole('separator')).toHaveCount(2);
  // С клавиатуры: ↓ — первый пункт, ↑ с первого — последний.
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: /Закрепить вверху/ })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(menu.getByRole('menuitem', { name: /В архив/ })).toBeFocused();

  // Без звука: запрос на сервер, значок в списке, в меню — обратное действие.
  await menu.getByRole('menuitem', { name: /Без звука/ }).click();
  await expect(menu).toBeHidden();
  await expect(anna.locator('.chat-conversation-flag[title="Без звука"]')).toBeVisible();
  await expect.poll(() => state.preferences).toEqual([{ id: 10, body: { isMuted: true } }]);
  await anna.click({ button: 'right' });
  await expect(menu.getByRole('menuitem', { name: /Включить звук/ })).toBeVisible();

  // Отметить прочитанным: счетчик пропадает.
  await menu.getByRole('menuitem', { name: /Отметить прочитанным/ }).click();
  await expect(anna.locator('.chat-unread-badge')).toHaveCount(0);
  await expect.poll(() => state.reads).toEqual([{ id: 10, messageId: 100 }]);

  // Escape и клик мимо закрывают меню; у прочитанного диалога пункта «прочитанным» нет.
  const oleg = sidebar.locator('.chat-conversation-item', { hasText: 'Иванов Олег' });
  await oleg.click({ button: 'right' });
  const olegMenu = page.getByRole('menu', { name: 'Действия с чатом «Иванов Олег»' });
  await expect(olegMenu.getByRole('menuitem', { name: /прочитанным/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(olegMenu).toBeHidden();
  await oleg.click({ button: 'right' });
  await page.mouse.click(1000, 400);
  await expect(olegMenu).toBeHidden();

  // «О собеседнике» открывает карточку диалога.
  await oleg.click({ button: 'right' });
  await olegMenu.getByRole('menuitem', { name: /О собеседнике/ }).click();
  await expect(page.locator('.modal-window')).toBeVisible();
});

test('archiving the open chat from the menu removes it and closes the conversation', async ({ page }) => {
  const state = await mockChat(page);
  await page.goto('/chat/11');
  await expect(page.locator('.chat-message')).toHaveCount(1);

  const sidebar = page.getByRole('complementary', { name: 'Диалоги' });
  await sidebar.locator('.chat-conversation-item', { hasText: 'Иванов Олег' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /В архив/ }).click();

  await expect(sidebar.locator('.chat-conversation-item', { hasText: 'Иванов Олег' })).toHaveCount(0);
  await expect(page).toHaveURL(/\/chat$/);
  expect(state.preferences).toEqual([{ id: 11, body: { isArchived: true } }]);
});

test('the menu works in the floating chat window and stays inside the screen', async ({ page }) => {
  const state = await mockChat(page);
  await page.goto('/employees');
  await page.getByRole('button', { name: /Открыть чат/ }).click();

  const dock = page.getByRole('region', { name: 'Окно чата' });
  const item = dock.locator('.chat-conversation-item', { hasText: 'Иванов Олег' });
  const box = (await item.boundingBox())!;
  // Клик у правого края экрана: меню открывается влево, не вылезая за окно.
  await item.click({ button: 'right', position: { x: box.width - 4, y: box.height / 2 } });
  const menu = page.getByRole('menu', { name: 'Действия с чатом «Иванов Олег»' });
  await expect(menu).toBeVisible();
  const menuBox = (await menu.boundingBox())!;
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(page.viewportSize()!.width);

  await menu.getByRole('menuitem', { name: /Закрепить вверху/ }).click();
  await expect(item.locator('.chat-conversation-flag[title="Закреплен"]')).toBeVisible();
  expect(state.preferences).toEqual([{ id: 11, body: { isPinned: true } }]);
});
