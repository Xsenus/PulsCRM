import { expect, test, type Locator, type Page } from '@playwright/test';
import { currentUser, fulfillJson, setupAuthenticatedSession } from './helpers';

const PEER = 2;
const now = Date.now();

const messages = [
  { id: 1, senderUserId: PEER, senderName: 'Плехов Никита', text: 'Ок' },
  { id: 2, senderUserId: currentUser.id, senderName: currentUser.fullName, text: 'Hi' }
].map((item, index) => ({
  ...item,
  conversationId: 10,
  kind: 0,
  createdAtUtc: new Date(now - (2 - index) * 60_000).toISOString(),
  isDeleted: false,
  attachments: [],
  reactions: []
}));

const users = Array.from({ length: 20 }, (_, index) => ({
  id: 100 + index,
  login: `user${index}`,
  displayName: index % 6 === 0 ? `Тестов Сотрудник ${index}` : `Сотрудник ${index}`,
  groupName: 'Отдел',
  isInactive: false
}));

async function mockChat(page: Page, dockOpen: boolean) {
  await setupAuthenticatedSession(page);
  await page.addInitScript(() => window.localStorage.removeItem('puls-chat-dock'));
  await page.route(/\/hubs\/chat/, (route) => route.fulfill({ status: 503, body: '' }));
  await page.route(/\/api\/chat\/status$/, (route) => fulfillJson(route, { enabled: true, currentUserId: currentUser.id, maxAttachmentBytes: 26214400, maxAttachmentsPerMessage: 10, maxMessageLength: 8000 }));
  await page.route(/\/api\/chat\/settings$/, (route) => fulfillJson(route, { notificationsEnabled: true, soundEnabled: false, soundName: 'chime', soundVolume: 70, showMessagePreview: true }));
  await page.route(/\/api\/chat\/dock$/, (route) => fulfillJson(route, { open: dockOpen, conversationId: dockOpen ? 10 : null, width: null, height: null }));
  await page.route(/\/api\/chat\/conversations(\?.*)?$/, (route) => fulfillJson(route, [{
    id: 10, kind: 0, title: 'Плехов Никита', peerUserId: PEER, myRole: 0, isMuted: false, isPinned: false, isArchived: false,
    unreadCount: 0, myLastReadMessageId: 2,
    createdAtUtc: new Date(now - 10_000_000).toISOString(), lastMessageAtUtc: messages[1].createdAtUtc, lastMessage: messages[1],
    participants: [
      { userId: currentUser.id, displayName: currentUser.fullName, role: 0, isInactive: false, lastReadMessageId: 2 },
      { userId: PEER, displayName: 'Плехов Никита', role: 0, isInactive: false, lastReadMessageId: 1 }
    ]
  }]));
  await page.route(/\/api\/chat\/conversations\/10\/messages(\?.*)?$/, (route) => fulfillJson(route, { items: messages, hasMoreBefore: false }));
  await page.route(/\/api\/chat\/conversations\/\d+\/read$/, (route) => route.fulfill({ status: 204 }));
  await page.route(/\/api\/chat\/delivered$/, (route) => route.fulfill({ status: 204 }));
  await page.route(/\/api\/chat\/users(\?.*)?$/, (route) => {
    const search = (new URL(route.request().url()).searchParams.get('search') ?? '').toLowerCase();
    return fulfillJson(route, users.filter((user) => user.displayName.toLowerCase().includes(search)));
  });
  await page.route(/\/api\/employees(\?.*)?$/, (route) => fulfillJson(route, { totalCount: 0, items: [] }));
}

function scrollSize(locator: Locator) {
  return locator.evaluate((node) => ({
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
    scrollHeight: node.scrollHeight,
    clientHeight: node.clientHeight
  }));
}

async function expectNoHorizontalScroll(locator: Locator) {
  const size = await scrollSize(locator);
  expect(size.scrollWidth).toBeLessThanOrEqual(size.clientWidth);
}

test('floating chat window: no toolbar over messages, the message menu stays inside the screen', async ({ page }) => {
  await mockChat(page, true);
  await page.goto('/employees');

  const dock = page.getByRole('region', { name: 'Окно чата' });
  const list = dock.locator('.chat-messages');
  await expect(dock.locator('.chat-message')).toHaveCount(2);
  await expectNoHorizontalScroll(list);

  for (const selector of ['.chat-message.own', '.chat-message:not(.own)']) {
    const message = dock.locator(selector);
    await message.hover();
    // Над сообщением при наведении больше ничего не рисуется — действия в меню по ПКМ.
    await expect(message.getByRole('toolbar')).toHaveCount(0);
    await expectNoHorizontalScroll(list);

    const bubble = message.locator('.chat-bubble');
    const box = (await bubble.boundingBox())!;
    await bubble.click({ button: 'right', position: { x: box.width - 2, y: box.height / 2 } });
    const menu = page.getByRole('menu', { name: 'Действия с сообщением' });
    await expect(menu).toBeVisible();
    const menuBox = (await menu.boundingBox())!;
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    await expectNoHorizontalScroll(list);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  }
});

test.describe('chat page on a full HD screen', () => {
  test.use({ viewport: { width: 1905, height: 919 } });

  test('fits the window without page scroll', async ({ page }) => {
    await mockChat(page, false);
    await page.goto('/chat/10');
    await expect(page.locator('.chat-message')).toHaveCount(2);

    const document = page.locator('html');
    const size = await scrollSize(document);
    expect(size.scrollHeight).toBeLessThanOrEqual(size.clientHeight);
    // Чат занимает высоту до низа окна (с нижним отступом страницы), а не «примерно».
    const chatBottom = (await page.locator('.chat-page').boundingBox())!;
    expect(919 - (chatBottom.y + chatBottom.height)).toBeLessThanOrEqual(40);
  });

  test('emoji picker and empty composer have no scrollbars they do not need', async ({ page }) => {
    await mockChat(page, false);
    // Как в Windows: полоса прокрутки занимает место.
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = '::-webkit-scrollbar { width: 17px; height: 17px; } ::-webkit-scrollbar-thumb { background: #999; }';
        document.head.append(style);
      });
    });
    await page.goto('/chat/10');

    const textarea = page.getByLabel('Текст сообщения');
    await expect(textarea).toBeVisible();
    let size = await scrollSize(textarea);
    expect(size.scrollHeight).toBeLessThanOrEqual(size.clientHeight);
    await expect(textarea).toHaveCSS('overflow-y', 'hidden');

    await page.getByRole('button', { name: /эмодзи/i }).last().click();
    const grid = page.locator('.chat-emoji-grid');
    await expect(grid).toBeVisible();
    await expectNoHorizontalScroll(grid);

    // Длинный текст: поле растет до 200 px и только тогда прокручивается.
    await textarea.fill(Array.from({ length: 20 }, (_, index) => `строка ${index}`).join('\n'));
    size = await scrollSize(textarea);
    expect(Math.round((await textarea.boundingBox())!.height)).toBe(200);
    await expect(textarea).toHaveCSS('overflow-y', 'auto');
  });

  test('new chat dialog keeps its size while searching and fits group icons in one row', async ({ page }) => {
    await mockChat(page, false);
    await page.goto('/chat/10');

    await page.getByRole('button', { name: 'Новый чат' }).first().click();
    const dialog = page.locator('.modal-window');
    await expect(dialog.locator('.chat-user-row')).toHaveCount(20);
    const before = (await dialog.boundingBox())!;

    await dialog.getByPlaceholder(/Поиск сотрудника/).fill('тестов');
    await expect(dialog.locator('.chat-user-row')).toHaveCount(4);
    const after = (await dialog.boundingBox())!;
    expect(after.y).toBe(before.y);
    expect(after.height).toBe(before.height);

    await dialog.getByRole('tab', { name: 'Групповой' }).click();
    const icons = dialog.getByRole('radiogroup', { name: 'Иконка чата' }).getByRole('radio');
    const tops = new Set(await icons.evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top))));
    expect(tops.size).toBe(1);
  });
});
