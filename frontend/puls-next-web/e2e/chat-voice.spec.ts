import { expect, test, type Page } from '@playwright/test';
import { currentUser, fulfillJson, setupAuthenticatedSession } from './helpers';

// Микрофон — поддельный (флаги Chromium в playwright.config.ts): запись без устройства и без вопроса о разрешении.

const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
const participants = [
  { userId: currentUser.id, displayName: currentUser.fullName, role: 0, isInactive: false, lastReadMessageId: 0 },
  { userId: 2, displayName: 'Петрова Анна Сергеевна', role: 0, isInactive: false, lastReadMessageId: 0 }
];
const conversation = { id: 10, kind: 0, title: 'Петрова Анна Сергеевна', peerUserId: 2, myRole: 0, isMuted: false, isPinned: false, isArchived: false, unreadCount: 0, myLastReadMessageId: 0,
  createdAtUtc: iso(100), lastMessageAtUtc: iso(100), participants };

/** WAV: секунда тишины (8 кГц, 8 бит) — настоящий звук для проигрывателя. */
function silenceWav() {
  const samples = 8000;
  const buffer = Buffer.alloc(44 + samples);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(8000, 24);
  buffer.writeUInt32LE(8000, 28);
  buffer.writeUInt16LE(1, 32);
  buffer.writeUInt16LE(8, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples, 40);
  buffer.fill(128, 44);
  return buffer;
}

async function mockChat(page: Page, messages: unknown[] = []) {
  const calls = { uploads: [] as string[], sent: [] as Array<{ attachmentIds?: number[]; text?: string }> };
  await setupAuthenticatedSession(page);
  await page.addInitScript(() => window.localStorage.removeItem('puls-chat-dock'));
  await page.route(/\/hubs\/chat/, (route) => route.fulfill({ status: 503, body: '' }));
  await page.route(/\/api\/chat\/status$/, (route) => fulfillJson(route, { enabled: true, currentUserId: currentUser.id, maxAttachmentBytes: 26214400, maxAttachmentsPerMessage: 10, maxMessageLength: 8000 }));
  await page.route(/\/api\/chat\/settings$/, (route) => fulfillJson(route, { notificationsEnabled: true, soundEnabled: false, soundName: 'chime', soundVolume: 70, showMessagePreview: true }));
  await page.route(/\/api\/chat\/dock$/, (route) => fulfillJson(route, { open: false, conversationId: null, width: null, height: null }));
  await page.route(/\/api\/chat\/conversations(\?.*)?$/, (route) => fulfillJson(route, [conversation]));
  await page.route(/\/api\/colleagues$/, (route) => fulfillJson(route, []));
  await page.route(/\/api\/chat\/conversations\/\d+\/read$/, (route) => route.fulfill({ status: 204 }));
  await page.route(/\/api\/chat\/conversations\/10\/attachments$/, async (route) => {
    const body = (route.request().postDataBuffer() ?? Buffer.alloc(0)).toString('latin1');
    calls.uploads.push(body);
    const isAudio = body.includes('Content-Type: audio/');
    const name = Buffer.from(/filename="([^"]+)"/.exec(body)?.[1] ?? 'file', 'latin1').toString('utf8');
    const duration = Number(/name="durationMs"\r\n\r\n(\d+)/.exec(body)?.[1] ?? 0) || null;
    await fulfillJson(route, { id: 900 + calls.uploads.length, conversationId: 10, fileName: name, contentType: isAudio ? 'audio/webm' : 'image/png', length: body.length,
      isImage: !isAudio, isAudio, durationMs: duration, uploadedAtUtc: new Date().toISOString() });
  });
  await page.route(/\/api\/chat\/conversations\/10\/messages(\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      calls.sent.push(body);
      await fulfillJson(route, { id: 500 + calls.sent.length, conversationId: 10, kind: 0, senderUserId: currentUser.id, senderName: currentUser.fullName, text: body.text ?? null, createdAtUtc: new Date().toISOString(),
        isDeleted: false, reactions: [], attachments: (body.attachmentIds ?? []).map((id: number) => ({ id, conversationId: 10, messageId: 500 + calls.sent.length, fileName: 'Голосовое сообщение.webm', contentType: 'audio/webm', length: 100, isImage: false, isAudio: true, durationMs: 1500, uploadedAtUtc: new Date().toISOString() })) });
      return;
    }

    await fulfillJson(route, { items: messages, hasMoreBefore: false });
  });
  return calls;
}

test('a voice message is recorded with the microphone and sent at once', async ({ page, context, baseURL }) => {
  await context.grantPermissions(['microphone'], { origin: baseURL });
  const calls = await mockChat(page);
  await page.goto('/chat/10');

  const textarea = page.getByLabel('Текст сообщения');
  // Пока поле пустое — вместо «Отправить» кнопка записи; с текстом — снова «Отправить».
  const mic = page.getByRole('button', { name: 'Записать голосовое сообщение' });
  await expect(mic).toBeVisible();
  await textarea.fill('текст');
  await expect(mic).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Отправить', exact: true })).toBeEnabled();
  await textarea.fill('');

  // Отмена: ничего не загружается.
  await mic.click();
  const bar = page.getByRole('group', { name: 'Запись голосового сообщения' });
  await expect(bar).toBeVisible();
  await bar.getByRole('button', { name: 'Отменить запись' }).click();
  await expect(bar).toHaveCount(0);
  expect(calls.uploads).toEqual([]);

  await mic.click();
  await expect(bar.locator('.chat-voice-recording-time')).toHaveText('0:01', { timeout: 5000 });
  await bar.getByRole('button', { name: 'Отправить голосовое сообщение' }).click();

  await expect.poll(() => calls.sent.length).toBe(1);
  expect(calls.uploads).toHaveLength(1);
  expect(calls.uploads[0]).toMatch(/Content-Type: audio\/(webm|ogg|mp4)/);
  expect(Number(/name="durationMs"\r\n\r\n(\d+)/.exec(calls.uploads[0])?.[1])).toBeGreaterThanOrEqual(1000);
  expect(calls.sent[0]).toMatchObject({ attachmentIds: [901] });
  expect(calls.sent[0].text).toBeUndefined();
  await expect(page.locator('.chat-message.own .chat-voice')).toBeVisible();
  await expect(page.locator('.chat-message.own .chat-voice-time')).toHaveText('0:02');
});

test('a voice message in the feed plays and shows its duration', async ({ page }) => {
  await mockChat(page, [
    { id: 1, conversationId: 10, kind: 0, senderUserId: 2, senderName: 'Петрова Анна Сергеевна', text: null, createdAtUtc: iso(5), isDeleted: false, reactions: [], attachments: [
      { id: 77, conversationId: 10, messageId: 1, fileName: 'Голосовое сообщение.webm', contentType: 'audio/wav', length: 8044, isImage: false, isAudio: true, durationMs: 12_000, uploadedAtUtc: iso(5) }
    ] }
  ]);
  let downloads = 0;
  await page.route(/\/api\/chat\/attachments\/77(\?.*)?$/, (route) => {
    downloads += 1;
    return route.fulfill({ status: 200, contentType: 'audio/wav', body: silenceWav() });
  });
  await page.goto('/chat/10');

  const player = page.locator('.chat-voice');
  await expect(player.locator('.chat-voice-time')).toHaveText('0:12');
  await expect(player.locator('.chat-voice-download')).toBeVisible();
  // Запись скачивается только по нажатию «▶».
  expect(downloads).toBe(0);
  await player.getByRole('button', { name: 'Прослушать голосовое сообщение' }).click();
  await expect(player.getByRole('button', { name: 'Пауза' })).toBeVisible();
  expect(downloads).toBe(1);
  // Реальная длительность файла (1 с) заменяет присланную.
  await expect(player.locator('.chat-voice-time')).toHaveText(/^0:0[01]$/);
  await expect(player.getByRole('button', { name: 'Прослушать голосовое сообщение' })).toBeVisible({ timeout: 5000 });
});

test('a pasted screenshot is attached with a clear name, even with the cursor outside the input', async ({ page }) => {
  const calls = await mockChat(page);
  await page.goto('/chat/10');
  await expect(page.getByLabel('Текст сообщения')).toBeVisible();

  const paste = (target: 'textarea' | 'body') => page.evaluate(async (where) => {
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 10;
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), 'image/png'));
    const data = new DataTransfer();
    data.items.add(new File([blob], 'image.png', { type: 'image/png' }));
    const element = where === 'textarea' ? document.querySelector('textarea')! : document.body;
    if (where === 'body') {
      (document.activeElement as HTMLElement | null)?.blur();
    }

    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, target);

  await paste('textarea');
  await expect(page.locator('.chat-upload-name')).toHaveText([/^Скриншот \d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2}\.png$/]);
  await paste('body');
  await expect(page.locator('.chat-upload-name')).toHaveCount(2);
  await expect.poll(() => calls.uploads.length).toBe(2);
  await expect(page.getByRole('button', { name: 'Отправить', exact: true })).toBeEnabled();
});
