import { expect, test, type Page } from '@playwright/test';
import { currentUser, fulfillJson, setupAuthenticatedSession } from './helpers';

const PEER = 2;
const now = Date.now();
// Прозрачный PNG 1×1.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

function photo(id: number) {
  return {
    id, conversationId: 10, fileName: `фото-${id}.jpg`, contentType: 'image/jpeg', length: 1000, isImage: true,
    uploadedAtUtc: new Date(now).toISOString(), width: 800, height: 600, hasThumbnail: true
  };
}

const messages = [
  { id: 1, senderUserId: PEER, senderName: 'Петрова Анна', text: 'Привет', attachments: [] as ReturnType<typeof photo>[] },
  { id: 2, senderUserId: currentUser.id, senderName: currentUser.fullName, text: 'Фото с объекта', attachments: [photo(51), photo(52), photo(53)] },
  { id: 3, senderUserId: currentUser.id, senderName: currentUser.fullName, text: 'Удалю это', attachments: [] as ReturnType<typeof photo>[] }
].map((item, index) => ({
  ...item, conversationId: 10, kind: 0, createdAtUtc: new Date(now - (3 - index) * 60_000).toISOString(), isDeleted: false, reactions: [] as unknown[]
}));

const conversations = [10, 11, 12, 13, 14, 15, 16, 17].map((id) => ({
  id, kind: 0, title: id === 10 ? 'Петрова Анна' : `Коллега ${id}${id % 2 ? ' Отдел' : ''}`, peerUserId: id === 10 ? PEER : id,
  myRole: 0, isMuted: false, isPinned: false, isArchived: false, unreadCount: 0, myLastReadMessageId: 3,
  createdAtUtc: new Date(now - 10_000_000).toISOString(), lastMessageAtUtc: messages[2].createdAtUtc, lastMessage: id === 10 ? messages[2] : null,
  participants: [
    { userId: currentUser.id, displayName: currentUser.fullName, role: 0, isInactive: false, lastReadMessageId: 3 },
    { userId: id === 10 ? PEER : id, displayName: 'Собеседник', role: 0, isInactive: false, lastReadMessageId: 3 }
  ]
}));

async function mockChat(page: Page) {
  const calls = { reactions: [] as unknown[], deleted: [] as number[] };
  await setupAuthenticatedSession(page);
  await page.addInitScript(() => window.localStorage.removeItem('puls-chat-dock'));
  await page.route(/\/hubs\/chat/, (route) => route.fulfill({ status: 503, body: '' }));
  await page.route(/\/api\/chat\/status$/, (route) => fulfillJson(route, { enabled: true, currentUserId: currentUser.id, maxAttachmentBytes: 26214400, maxAttachmentsPerMessage: 10, maxMessageLength: 8000 }));
  await page.route(/\/api\/chat\/settings$/, (route) => fulfillJson(route, { notificationsEnabled: true, soundEnabled: false, soundName: 'chime', soundVolume: 70, showMessagePreview: true }));
  await page.route(/\/api\/chat\/dock$/, (route) => fulfillJson(route, { open: false, conversationId: null, width: null, height: null }));
  await page.route(/\/api\/chat\/conversations(\?.*)?$/, (route) => fulfillJson(route, conversations));
  await page.route(/\/api\/chat\/conversations\/10\/messages(\?.*)?$/, (route) => fulfillJson(route, { items: messages, hasMoreBefore: false }));
  await page.route(/\/api\/chat\/conversations\/\d+\/read$/, (route) => route.fulfill({ status: 204 }));
  await page.route(/\/api\/chat\/delivered$/, (route) => route.fulfill({ status: 204 }));
  await page.route(/\/api\/chat\/attachments\/\d+(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.route(/\/api\/chat\/messages\/\d+\/reactions$/, async (route) => {
    calls.reactions.push(route.request().postDataJSON());
    await fulfillJson(route, { ...messages[0], reactions: [{ emoji: '👍', count: 1, reactedByMe: true, userIds: [currentUser.id] }] });
  });
  await page.route(/\/api\/chat\/messages\/3$/, async (route) => {
    if (route.request().method() === 'DELETE') {
      calls.deleted.push(3);
      await fulfillJson(route, { ...messages[2], text: null, isDeleted: true });
      return;
    }

    await route.fallback();
  });
  await page.route(/\/api\/employees(\?.*)?$/, (route) => fulfillJson(route, { totalCount: 0, items: [] }));
  return calls;
}

test('right click on a message opens one menu with reactions and all actions', async ({ page }) => {
  const calls = await mockChat(page);
  await page.goto('/chat/10');

  const first = page.locator('[data-message-id="1"]');
  await first.hover();
  await expect(first.getByRole('toolbar')).toHaveCount(0);

  await first.locator('.chat-bubble').click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Действия с сообщением' });
  await expect(menu.getByRole('group', { name: 'Реакции' }).getByRole('menuitem')).toHaveCount(8);
  // Чужое сообщение: изменить и удалить нельзя.
  await expect(menu.locator('.chat-menu-label')).toHaveText(['Ответить', 'Переслать', 'Копировать текст']);
  // Реакции — внизу, последней группой.
  await expect(menu.locator(':scope > *').last()).toHaveAttribute('aria-label', 'Реакции');
  // Группы разделены чертой: ответить, переслать | копировать | реакции (удалять чужое нельзя — без пустой группы).
  await expect(menu.getByRole('separator')).toHaveCount(2);

  await menu.getByRole('menuitem', { name: 'Реакция 👍' }).click();
  await expect(menu).toBeHidden();
  await expect(first.locator('.chat-reaction.mine')).toContainText('👍');
  // Как в Telegram: плашка реакции — внутри пузыря, в одной строке со временем.
  await expect(first.locator('.chat-bubble .chat-bubble-footer .chat-reaction.mine')).toBeVisible();
  expect(calls.reactions).toEqual([{ emoji: '👍' }]);

  // Свое сообщение: есть «Изменить» и «Удалить»; «Ответить» ставит ответ в поле ввода.
  const own = page.locator('[data-message-id="3"]');
  await own.locator('.chat-bubble').click({ button: 'right' });
  await expect(menu.getByRole('menuitem', { name: /Изменить/ })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /Удалить/ })).toBeVisible();
  await expect(menu.getByRole('separator')).toHaveCount(3);
  await menu.getByRole('menuitem', { name: /Ответить/ }).click();
  await expect(page.locator('.chat-composer-context')).toContainText('Ответ');

  // По ссылке и выделенному тексту остается обычное меню браузера (наше не открывается).
  await page.keyboard.press('Escape');
});

test('deleting a message asks in a dialog, not the browser confirm', async ({ page }) => {
  const calls = await mockChat(page);
  page.on('dialog', () => {
    throw new Error('Системный диалог браузера не должен появляться');
  });
  await page.goto('/chat/10');

  const own = page.locator('[data-message-id="3"]');
  await own.locator('.chat-bubble').click({ button: 'right' });
  await page.getByRole('menuitem', { name: /Удалить/ }).click();

  const dialog = page.getByRole('dialog', { name: 'Удалить сообщение?' });
  await expect(dialog).toContainText('Удалю это');
  await expect(dialog).toContainText('пропадет у всех участников');
  await dialog.getByRole('button', { name: 'Отмена' }).click();
  await expect(dialog).toBeHidden();
  expect(calls.deleted).toEqual([]);

  await own.locator('.chat-bubble').click({ button: 'right' });
  await page.getByRole('menuitem', { name: /Удалить/ }).click();
  await dialog.getByRole('button', { name: 'Удалить' }).click();
  await expect(dialog).toBeHidden();
  await expect(own).toContainText('Сообщение удалено');
  expect(calls.deleted).toEqual([3]);
});

test('forward dialog shows the photos and keeps its size while searching', async ({ page }) => {
  await mockChat(page);
  await page.goto('/chat/10');

  await page.locator('[data-message-id="2"] .chat-bubble-text').click({ button: 'right' });
  await page.getByRole('menuitem', { name: /Переслать/ }).click();

  const dialog = page.getByRole('dialog', { name: 'Переслать сообщение' });
  const thumbs = dialog.locator('.chat-forward-images .chat-mini-thumb img');
  await expect(thumbs).toHaveCount(3);
  await expect(thumbs.first()).toHaveAttribute('src', /^blob:/);
  await expect(dialog.locator('.chat-forward-caption')).toHaveText('Фото с объекта');

  const before = (await dialog.boundingBox())!;
  await dialog.getByLabel('Найти чат').fill('отдел');
  await expect(dialog.getByRole('option')).toHaveCount(4);
  const after = (await dialog.boundingBox())!;
  expect(after.y).toBe(before.y);
  expect(after.height).toBe(before.height);
});
