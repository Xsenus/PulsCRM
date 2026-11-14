import { expect, test, type Page } from '@playwright/test';
import { currentUser, fulfillJson, setupAuthenticatedSession } from './helpers';

const now = Date.now();
const PEER = 2;
const TOTAL = 150;
const LAST_READ = 90;

function makeMessage(id: number, conversationId = 10) {
  const own = id % 7 === 0;
  return {
    id,
    conversationId,
    kind: 0,
    senderUserId: own ? currentUser.id : PEER,
    senderName: own ? currentUser.fullName : 'Петрова Анна Сергеевна',
    text: `Сообщение номер ${id}${id % 5 === 0 ? '\nвторая строка для высоты' : ''}`,
    createdAtUtc: new Date(now - (TOTAL - id) * 60_000).toISOString(),
    isDeleted: false,
    attachments: [],
    reactions: []
  };
}

const history10 = Array.from({ length: TOTAL }, (_, index) => makeMessage(index + 1));
const history11 = Array.from({ length: 80 }, (_, index) => ({ ...makeMessage(1000 + index, 11), senderUserId: 3, senderName: 'Иванов Олег' }));

function conversations(unread10: number) {
  return [
    {
      id: 10, kind: 0, title: 'Петрова Анна Сергеевна', peerUserId: PEER, myRole: 0, isMuted: false, isPinned: false, isArchived: false,
      unreadCount: unread10, myLastReadMessageId: unread10 > 0 ? LAST_READ : TOTAL,
      createdAtUtc: new Date(now - 10_000_000).toISOString(), lastMessageAtUtc: history10[TOTAL - 1].createdAtUtc, lastMessage: history10[TOTAL - 1],
      participants: [
        { userId: currentUser.id, displayName: currentUser.fullName, role: 0, isInactive: false, lastReadMessageId: LAST_READ },
        { userId: PEER, displayName: 'Петрова Анна Сергеевна', role: 0, isInactive: false, lastReadMessageId: 140, lastDeliveredMessageId: 147 }
      ]
    },
    {
      id: 11, kind: 0, title: 'Иванов Олег', peerUserId: 3, myRole: 0, isMuted: false, isPinned: false, isArchived: false,
      unreadCount: 0, myLastReadMessageId: 1079,
      createdAtUtc: new Date(now - 10_000_000).toISOString(), lastMessageAtUtc: history11[79].createdAtUtc, lastMessage: history11[79],
      participants: [
        { userId: currentUser.id, displayName: currentUser.fullName, role: 0, isInactive: false, lastReadMessageId: 1079 },
        { userId: 3, displayName: 'Иванов Олег', role: 0, isInactive: false, lastReadMessageId: 1079 }
      ]
    }
  ];
}

async function mockReading(page: Page, unread10: number) {
  const reads: number[] = [];
  const delivered: unknown[] = [];
  await setupAuthenticatedSession(page);
  await page.route(/\/hubs\/chat/, (route) => route.fulfill({ status: 503, body: '' }));
  await page.route(/\/api\/chat\/status$/, (route) => fulfillJson(route, { enabled: true, currentUserId: currentUser.id, maxAttachmentBytes: 26214400, maxAttachmentsPerMessage: 10, maxMessageLength: 8000 }));
  await page.route(/\/api\/chat\/settings$/, (route) => fulfillJson(route, { notificationsEnabled: true, soundEnabled: false, soundName: 'chime', soundVolume: 70, showMessagePreview: true }));
  await page.route(/\/api\/chat\/dock$/, (route) => fulfillJson(route, { open: false, conversationId: null, width: null, height: null }));
  await page.route(/\/api\/chat\/conversations(\?.*)?$/, (route) => fulfillJson(route, conversations(unread10)));
  await page.route(/\/api\/chat\/conversations\/(10|11)\/messages(\?.*)?$/, (route) => {
    const url = new URL(route.request().url());
    const all = url.pathname.includes('/10/') ? history10 : history11;
    const before = Number(url.searchParams.get('before')) || Infinity;
    const take = Number(url.searchParams.get('take')) || 50;
    const older = all.filter((item) => item.id < before);
    const items = older.slice(-take);
    return fulfillJson(route, { items, hasMoreBefore: older.length > items.length });
  });
  await page.route(/\/api\/chat\/conversations\/\d+\/read$/, (route) => {
    reads.push(route.request().postDataJSON()?.messageId ?? 0);
    return route.fulfill({ status: 204 });
  });
  await page.route(/\/api\/chat\/delivered$/, (route) => {
    delivered.push(route.request().postDataJSON());
    return route.fulfill({ status: 204 });
  });
  return { reads, delivered };
}

async function visibleMessageIds(page: Page) {
  return page.evaluate(() => {
    const list = document.querySelector('.chat-messages');
    if (!list) {
      return [] as number[];
    }

    const box = list.getBoundingClientRect();
    return Array.from(list.querySelectorAll<HTMLElement>('.chat-message[data-message-id]'))
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.bottom > box.top && rect.top < box.bottom;
      })
      .map((node) => Number(node.dataset.messageId));
  });
}

test('opens on the first new message, reads as you scroll and does not jump to the bottom', async ({ page }) => {
  const { reads, delivered } = await mockReading(page, TOTAL - LAST_READ);
  await page.goto('/chat/10');

  // 60 непрочитанных — больше одной страницы: история догружается, лента стоит на «Новые сообщения».
  const divider = page.locator('.chat-unread-divider');
  await expect(divider).toBeInViewport();
  const visible = await visibleMessageIds(page);
  expect(Math.min(...visible)).toBeLessThanOrEqual(LAST_READ + 1);
  expect(visible).not.toContain(TOTAL);
  await expect(page.getByRole('button', { name: 'К последним сообщениям' })).toBeVisible();

  // Прочитано только то, что уже на экране, а не весь диалог.
  await expect.poll(() => reads.length).toBeGreaterThan(0);
  expect(Math.max(...reads)).toBeLessThan(TOTAL);
  expect(Math.max(...reads)).toBeGreaterThan(LAST_READ);

  // Пролистали чуть ниже — отметка прочтения сдвинулась.
  const before = Math.max(...reads);
  await page.locator('.chat-messages').evaluate((node) => { node.scrollTop += 300; });
  await expect.poll(() => Math.max(...reads)).toBeGreaterThan(before);
  expect(Math.max(...reads)).toBeLessThan(TOTAL);

  // Последнее сообщение — от собеседника, доставку отмечаем.
  await expect.poll(() => delivered.length).toBe(1);
  expect(delivered[0]).toEqual({ items: [{ conversationId: 10, messageId: TOTAL }] });

  // Кнопка вниз доводит до конца и отмечает все.
  await page.getByRole('button', { name: 'К последним сообщениям' }).click();
  await expect.poll(() => Math.max(...reads)).toBe(TOTAL);
  await expect(page.getByRole('button', { name: 'К последним сообщениям' })).toHaveCount(0);
});

test('shows grey and blue ticks for delivered and read own messages', async ({ page }) => {
  await mockReading(page, 0);
  await page.goto('/chat/10');
  // 147 — своё (147 % 7 == 0), собеседник: доставлено до 147, прочитано до 140.
  const delivered = page.locator('[data-message-id="147"] .chat-ticks');
  const read = page.locator('[data-message-id="140"] .chat-ticks');
  await expect(delivered).toHaveAttribute('aria-label', 'Доставлено');
  await expect(read).toHaveAttribute('aria-label', 'Прочитано');
  const colors = await Promise.all([delivered, read].map((item) => item.evaluate((node) => getComputedStyle(node).color)));
  expect(colors[0]).not.toBe(colors[1]);
  // Последнее сообщение диалога — от собеседника, поэтому в списке галочек нет.
  await expect(page.locator('.chat-conversation-item', { hasText: 'Петрова' }).locator('.chat-ticks')).toHaveCount(0);
});

test('remembers where the user stopped reading and returns there', async ({ page }) => {
  await mockReading(page, 0);
  await page.goto('/chat/10');
  await expect.poll(async () => Math.max(...(await visibleMessageIds(page)))).toBe(TOTAL);

  // Пролистали наверх, до ~100-го сообщения.
  const list = page.locator('.chat-messages');
  await list.evaluate((node) => {
    const target = node.querySelector<HTMLElement>('[data-message-id="110"]')!;
    node.scrollTop += target.getBoundingClientRect().top - node.getBoundingClientRect().top;
  });
  await expect.poll(async () => Math.min(...(await visibleMessageIds(page)))).toBe(110);
  await page.waitForTimeout(600);

  // Ушли в другой диалог и вернулись.
  await page.locator('.chat-conversation-item', { hasText: 'Иванов Олег' }).click();
  await expect(page).toHaveURL(/\/chat\/11$/);
  await page.locator('.chat-conversation-item', { hasText: 'Петрова' }).click();
  await expect(page).toHaveURL(/\/chat\/10$/);
  await expect.poll(async () => Math.min(...(await visibleMessageIds(page)))).toBe(110);

  // После перезагрузки — тоже.
  await page.reload();
  await expect.poll(async () => Math.min(...(await visibleMessageIds(page)))).toBe(110);

  // Долистали до конца — место забывается, следующее открытие внизу.
  await page.getByRole('button', { name: 'К последним сообщениям' }).click();
  await expect.poll(async () => Math.max(...(await visibleMessageIds(page)))).toBe(TOTAL);
  await page.waitForTimeout(600);
  await page.reload();
  await expect.poll(async () => Math.max(...(await visibleMessageIds(page)))).toBe(TOTAL);
});
