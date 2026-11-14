import { expect, test, type Page } from '@playwright/test';
import { currentUser, expectNoDocumentHorizontalOverflow, fulfillJson, setupAuthenticatedSession } from './helpers';

const now = new Date().toISOString();
/** Пропорции 10 фото альбома: альбомные, портретные, квадрат, панорама. */
const SIZES: Array<[number, number]> = [[1600, 1200], [1200, 1600], [1600, 1200], [1920, 1080], [1000, 1000], [900, 1200], [1600, 1200], [1600, 1200], [1080, 1920], [1000, 1000]];

async function mockAlbum(page: Page) {
  const uploads: Array<{ at: number; done?: number }> = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const sent: Array<{ attachmentIds: number[] }> = [];
  await setupAuthenticatedSession(page);
  await page.route(/\/hubs\/chat/, (route) => route.fulfill({ status: 503, body: '' }));
  await page.route(/\/api\/chat\/status$/, (route) => fulfillJson(route, { enabled: true, currentUserId: currentUser.id, maxAttachmentBytes: 26214400, maxAttachmentsPerMessage: 10, maxMessageLength: 8000 }));
  await page.route(/\/api\/chat\/settings$/, (route) => fulfillJson(route, { notificationsEnabled: true, soundEnabled: false, soundName: 'chime', soundVolume: 70, showMessagePreview: true }));
  await page.route(/\/api\/chat\/dock$/, (route) => fulfillJson(route, { open: false, conversationId: null, width: null, height: null }));
  await page.route(/\/api\/chat\/(delivered|conversations\/\d+\/read)$/, (route) => route.fulfill({ status: 204 }));
  await page.route(/\/api\/chat\/conversations(\?.*)?$/, (route) => fulfillJson(route, [{
    id: 10, kind: 0, title: 'Петрова Анна Сергеевна', peerUserId: 2, myRole: 0, isMuted: false, isPinned: false, isArchived: false,
    unreadCount: 0, myLastReadMessageId: 1, createdAtUtc: now, lastMessageAtUtc: now, lastMessage: null,
    participants: [
      { userId: currentUser.id, displayName: currentUser.fullName, role: 0, isInactive: false, lastReadMessageId: 1 },
      { userId: 2, displayName: 'Петрова Анна Сергеевна', role: 0, isInactive: false, lastReadMessageId: 1 }
    ]
  }]));
  await page.route(/\/api\/chat\/conversations\/10\/attachments$/, async (route) => {
    // Номер фото — из имени файла: запросы идут параллельно и приходят не по порядку.
    const body = (route.request().postDataBuffer() ?? Buffer.alloc(0)).toString('utf8');
    const index = Number(/-(\d+)\.png"/.exec(body)?.[1] ?? '1') - 1;
    uploads.push({ at: Date.now() });
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 200));
    inFlight -= 1;
    const [width, height] = SIZES[index] ?? [1000, 1000];
    await fulfillJson(route, { id: 900 + index, conversationId: 10, fileName: `фото-${index + 1}.png`, contentType: 'image/png', length: 1, isImage: true, hasThumbnail: false, width, height, uploadedAtUtc: now });
  });
  await page.route(/\/api\/chat\/conversations\/10\/messages(\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      sent.push(body);
      await fulfillJson(route, {
        id: 50, conversationId: 10, kind: 0, senderUserId: currentUser.id, senderName: currentUser.fullName, text: body.text ?? null, createdAtUtc: new Date().toISOString(), isDeleted: false, reactions: [],
        attachments: (body.attachmentIds as number[]).map((id, index) => ({ id, conversationId: 10, messageId: 50, fileName: `фото-${index + 1}.png`, contentType: 'image/png', length: 1, isImage: true, hasThumbnail: false, width: SIZES[index][0], height: SIZES[index][1], uploadedAtUtc: now }))
      });
      return;
    }

    await fulfillJson(route, { items: [], hasMoreBefore: false });
  });
  await page.route(/\/api\/chat\/attachments\/\d+(\?.*)?$/, (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/').pop());
    const [width, height] = SIZES[id - 900] ?? [10, 10];
    // Цветная картинка нужной пропорции, чтобы видеть раскладку.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width / 10}" height="${height / 10}"><rect width="100%" height="100%" fill="hsl(${(id * 47) % 360} 60% 60%)"/><text x="50%" y="55%" font-size="${Math.min(width, height) / 30}" text-anchor="middle" fill="white">${id - 899}</text></svg>`;
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg });
  });
  return { uploads, sent, stats: () => ({ maxInFlight }) };
}

async function makePng(page: Page, width: number, height: number, hue: number) {
  const base64 = await page.evaluate(({ width: w, height: h, hue: color }) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext('2d')!;
    context.fillStyle = `hsl(${color} 60% 55%)`;
    context.fillRect(0, 0, w, h);
    return canvas.toDataURL('image/png').split(',')[1];
  }, { width, height, hue });
  return Buffer.from(base64, 'base64');
}

test('ten photos are sent as one message and shown as an album', async ({ page }) => {
  const { uploads, sent, stats } = await mockAlbum(page);
  await page.goto('/chat/10');
  await expect(page.getByLabel('Текст сообщения')).toBeVisible();

  const files = await Promise.all(SIZES.map(async ([width, height], index) => ({
    name: `фото-${index + 1}.png`,
    mimeType: 'image/png',
    buffer: await makePng(page, width / 4, height / 4, index * 36)
  })));
  await page.locator('input[type="file"]').setInputFiles(files);

  await expect(page.locator('.chat-upload')).toHaveCount(10);
  await expect.poll(() => uploads.length, { timeout: 15000 }).toBe(10);
  // Отправляем не больше 3 файлов одновременно.
  expect(stats().maxInFlight).toBeLessThanOrEqual(3);

  const send = page.getByRole('button', { name: 'Отправить' });
  await expect(send).toBeEnabled({ timeout: 10000 });
  await page.getByLabel('Текст сообщения').fill('Фото с объекта');
  await send.click();

  await expect.poll(() => sent.length).toBe(1);
  // Порядок фото в сообщении — как их выбрали, независимо от того, какое загрузилось первым.
  expect(sent[0].attachmentIds).toEqual(Array.from({ length: 10 }, (_, index) => 900 + index));

  const album = page.locator('[data-message-id="50"] .chat-album');
  await expect(album).toHaveAttribute('aria-label', 'Альбом: 10 фото');
  const tiles = album.locator('.chat-image-thumb');
  await expect(tiles).toHaveCount(10);
  await expect(album.locator('.chat-image-full')).toHaveCount(10);

  // Плитки не выходят за альбом и не перекрываются, рядов несколько.
  const boxes = await tiles.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height })));
  const albumBox = (await album.boundingBox())!;
  for (const box of boxes) {
    expect(box.x).toBeGreaterThanOrEqual(albumBox.x - 0.5);
    expect(box.x + box.w).toBeLessThanOrEqual(albumBox.x + albumBox.width + 0.5);
    expect(box.y + box.h).toBeLessThanOrEqual(albumBox.y + albumBox.height + 0.5);
  }

  for (let a = 0; a < boxes.length; a += 1) {
    for (let b = a + 1; b < boxes.length; b += 1) {
      const overlapX = Math.min(boxes[a].x + boxes[a].w, boxes[b].x + boxes[b].w) - Math.max(boxes[a].x, boxes[b].x);
      const overlapY = Math.min(boxes[a].y + boxes[a].h, boxes[b].y + boxes[b].h) - Math.max(boxes[a].y, boxes[b].y);
      expect(overlapX > 1 && overlapY > 1).toBe(false);
    }
  }

  expect(new Set(boxes.map((box) => Math.round(box.y))).size).toBeGreaterThanOrEqual(4);
  await expect(page.locator('[data-message-id="50"] .chat-bubble-text')).toHaveText('Фото с объекта');

  // Клик по плитке открывает просмотр с листанием по всем 10.
  await tiles.nth(3).click();
  await expect(page.locator('.chat-lightbox-name')).toContainText('4 из 10');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.chat-lightbox-name')).toContainText('5 из 10');
  await page.keyboard.press('Escape');

  expect(await expectNoDocumentHorizontalOverflow(page)).toBe(true);
  await page.locator('[data-message-id="50"]').screenshot({ path: process.env.ALBUM_SHOT ?? 'test-results/album.png' });
});
