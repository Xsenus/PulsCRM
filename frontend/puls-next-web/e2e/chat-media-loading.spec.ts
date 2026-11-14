import { expect, test, type Page } from '@playwright/test';
import { currentUser, fulfillJson, setupAuthenticatedSession } from './helpers';

const now = Date.now();
const TOTAL = 120;
// Крошечный JPEG 2×2 как data:URL — «размытое превью».
const PREVIEW = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAACAAIBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=';
const pngPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

/** Каждое третье сообщение — с фото 4:3. */
function makeMessage(id: number) {
  const withPhoto = id % 3 === 0;
  return {
    id,
    conversationId: 10,
    kind: 0,
    senderUserId: 2,
    senderName: 'Петрова Анна Сергеевна',
    text: withPhoto ? null : `Сообщение номер ${id}`,
    createdAtUtc: new Date(now - (TOTAL - id) * 60_000).toISOString(),
    isDeleted: false,
    reactions: [],
    attachments: withPhoto
      ? [{ id: 5000 + id, conversationId: 10, messageId: id, fileName: `фото-${id}.jpg`, contentType: 'image/jpeg', length: 3_000_000, isImage: true, hasThumbnail: true, width: 1600, height: 1200, previewDataUrl: PREVIEW, uploadedAtUtc: new Date(now).toISOString() }]
      : []
  };
}

const history = Array.from({ length: TOTAL }, (_, index) => makeMessage(index + 1));

async function mockMedia(page: Page, imageDelayMs: number) {
  const imageRequests: number[] = [];
  const pageRequests: Array<number | null> = [];
  let inFlight = 0;
  let maxInFlight = 0;
  await setupAuthenticatedSession(page);
  await page.route(/\/hubs\/chat/, (route) => route.fulfill({ status: 503, body: '' }));
  await page.route(/\/api\/chat\/status$/, (route) => fulfillJson(route, { enabled: true, currentUserId: currentUser.id, maxAttachmentBytes: 26214400, maxAttachmentsPerMessage: 10, maxMessageLength: 8000 }));
  await page.route(/\/api\/chat\/settings$/, (route) => fulfillJson(route, { notificationsEnabled: true, soundEnabled: false, soundName: 'chime', soundVolume: 70, showMessagePreview: true }));
  await page.route(/\/api\/chat\/dock$/, (route) => fulfillJson(route, { open: false, conversationId: null, width: null, height: null }));
  await page.route(/\/api\/chat\/(delivered|conversations\/\d+\/read)$/, (route) => route.fulfill({ status: 204 }));
  await page.route(/\/api\/chat\/conversations(\?.*)?$/, (route) => fulfillJson(route, [{
    id: 10, kind: 0, title: 'Петрова Анна Сергеевна', peerUserId: 2, myRole: 0, isMuted: false, isPinned: false, isArchived: false,
    unreadCount: 0, myLastReadMessageId: TOTAL, createdAtUtc: history[0].createdAtUtc, lastMessageAtUtc: history[TOTAL - 1].createdAtUtc, lastMessage: history[TOTAL - 1],
    participants: [
      { userId: currentUser.id, displayName: currentUser.fullName, role: 0, isInactive: false, lastReadMessageId: TOTAL },
      { userId: 2, displayName: 'Петрова Анна Сергеевна', role: 0, isInactive: false, lastReadMessageId: TOTAL }
    ]
  }]));
  await page.route(/\/api\/chat\/conversations\/10\/messages(\?.*)?$/, (route) => {
    const url = new URL(route.request().url());
    const before = Number(url.searchParams.get('before')) || null;
    pageRequests.push(before);
    const take = Number(url.searchParams.get('take')) || 50;
    const older = history.filter((item) => item.id < (before ?? Infinity));
    const items = older.slice(-take);
    return fulfillJson(route, { items, hasMoreBefore: older.length > items.length });
  });
  await page.route(/\/api\/chat\/attachments\/\d+(\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    imageRequests.push(Number(url.pathname.split('/').pop()));
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, imageDelayMs));
    inFlight -= 1;
    await route.fulfill({ status: 200, contentType: 'image/png', body: pngPixel, headers: { 'Cache-Control': 'private, max-age=86400' } }).catch(() => undefined);
  });
  return { imageRequests, pageRequests, stats: () => ({ maxInFlight }) };
}

test('loads only nearby photos, at most four at a time, and history as you scroll up', async ({ page }) => {
  const { imageRequests, pageRequests, stats } = await mockMedia(page, 150);
  await page.goto('/chat/10');
  await expect(page.locator('[data-message-id="120"]')).toBeInViewport();

  // Первая страница — 50 сообщений, из них 16 с фото; грузятся только те, что рядом с экраном.
  await page.waitForTimeout(1200);
  const initial = imageRequests.length;
  expect(initial).toBeGreaterThan(0);
  expect(initial).toBeLessThan(16);
  expect(imageRequests.every((id) => id > 5000 + 60)).toBe(true);
  expect(stats().maxInFlight).toBeLessThanOrEqual(4);
  // Первая страница запрошена один раз, старая история — пока нет.
  expect(pageRequests).toEqual([null]);

  // Листаем вверх: следующая страница истории приходит заранее, фото догружаются.
  const list = page.locator('.chat-messages');
  for (let step = 0; step < 9; step += 1) {
    await list.evaluate((node) => { node.scrollTop -= 700; });
    await page.waitForTimeout(250);
  }

  await expect.poll(() => pageRequests.length).toBeGreaterThan(1);
  // Подгрузили заранее: до верха ленты еще оставался запас, а не «уперлись в потолок».
  expect(pageRequests[1]).toBe(history[TOTAL - 50].id);
  await expect.poll(() => imageRequests.length).toBeGreaterThan(initial);
  expect(stats().maxInFlight).toBeLessThanOrEqual(4);
  expect(new Set(imageRequests).size).toBe(imageRequests.length);
});

test('shows text and a blurred preview at once, the sharp photo replaces it later', async ({ page }) => {
  await mockMedia(page, 1500);
  const thumbnailUrls: string[] = [];
  page.on('request', (request) => request.url().includes('/attachments/') && thumbnailUrls.push(request.url()));
  await page.goto('/chat/10');

  const photo = page.locator('[data-message-id="120"] .chat-image-thumb');
  await expect(page.locator('[data-message-id="119"]')).toContainText('Сообщение номер 119');
  await expect(photo.locator('.chat-image-blur')).toBeVisible();
  await expect(photo).not.toHaveClass(/loaded/);
  // Место под фото зарезервировано по пропорциям 4:3 — лента не прыгнет.
  const box = await photo.boundingBox();
  expect(box!.width / box!.height).toBeCloseTo(4 / 3, 1);

  await expect(photo).toHaveClass(/loaded/, { timeout: 5000 });
  await expect(photo.locator('.chat-image-blur')).toHaveCount(0);
  await expect(photo.locator('.chat-image-full')).toBeVisible();
  expect(thumbnailUrls.every((url) => url.includes('thumbnail=true'))).toBe(true);
});
