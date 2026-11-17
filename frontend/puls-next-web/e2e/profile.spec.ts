import { expect, test, type Page } from '@playwright/test';
import { fulfillJson, regularUser, setupAuthenticatedSession } from './helpers';

// Цветная картинка 120×80 (PNG) — сжимается в квадратное JPEG-фото профиля.
async function makePng(page: Page) {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 80;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#2563eb';
    context.fillRect(0, 0, 120, 80);
    return canvas.toDataURL('image/png');
  });
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

const later = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(23, 59, 0, 0);
  return date;
};

async function mockProfile(page: Page) {
  const calls = { contacts: [] as unknown[], photo: [] as string[], password: [] as unknown[], status: [] as unknown[], clearedStatus: 0, me: 0 };
  let profile = {
    id: regularUser.id,
    login: regularUser.login,
    fullName: regularUser.fullName,
    position: 'Бухгалтер',
    department: 'Бухгалтерия',
    email: 'maria@example.test',
    phone: '+7 900 000-00-00',
    internalPhone: null as string | null,
    hasPhoto: false,
    status: null as unknown
  };

  await setupAuthenticatedSession(page, regularUser);
  await page.route(/\/api\/auth\/me(?:\?.*)?$/, (route) => {
    calls.me += 1;
    return fulfillJson(route, regularUser);
  });
  await page.addInitScript(() => window.localStorage.removeItem('puls-chat-dock'));
  await page.route(/\/hubs\/chat/, (route) => route.fulfill({ status: 503, body: '' }));
  await page.route(/\/api\/chat\/status$/, (route) => fulfillJson(route, { enabled: false, currentUserId: regularUser.id, maxAttachmentBytes: 0, maxAttachmentsPerMessage: 0, maxMessageLength: 0 }));
  await page.route(/\/api\/colleagues$/, (route) => fulfillJson(route, []));
  await page.route(/\/api\/profile$/, (route) => fulfillJson(route, profile));
  await page.route(/\/api\/profile\/contacts$/, (route) => {
    const body = route.request().postDataJSON();
    calls.contacts.push(body);
    profile = { ...profile, phone: body.phone, internalPhone: body.internalPhone };
    return fulfillJson(route, profile);
  });
  await page.route(/\/api\/profile\/photo$/, (route) => {
    if (route.request().method() === 'DELETE') {
      profile = { ...profile, hasPhoto: false };
    } else {
      calls.photo.push(route.request().postDataJSON().imageBase64);
      profile = { ...profile, hasPhoto: true };
    }

    return fulfillJson(route, profile);
  });
  await page.route(/\/api\/colleagues\/\d+\/photo$/, async (route) => route.fulfill({ status: 200, contentType: 'image/png', body: await makePng(page) }));
  await page.route(/\/api\/profile\/password$/, (route) => {
    const body = route.request().postDataJSON();
    calls.password.push(body);
    return body.currentPassword === 'старый'
      ? route.fulfill({ status: 204 })
      : fulfillJson(route, { message: 'Текущий пароль указан неверно.' }, 400);
  });
  await page.route(/\/api\/profile\/status$/, (route) => {
    if (route.request().method() === 'DELETE') {
      calls.clearedStatus += 1;
      profile = { ...profile, status: null };
      return route.fulfill({ status: 204 });
    }

    const body = route.request().postDataJSON();
    calls.status.push(body);
    profile = { ...profile, status: body };
    return fulfillJson(route, body);
  });
  return calls;
}

test('an employee opens «Мой профиль» from the user menu and sets a vacation status', async ({ page }) => {
  const calls = await mockProfile(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Открыть меню пользователя' }).click();
  await page.getByRole('button', { name: 'Мой профиль' }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole('heading', { level: 2, name: regularUser.fullName })).toBeVisible();
  await expect(page.locator('.profile-identity')).toContainText('Бухгалтер');
  await expect(page.locator('.profile-identity')).toContainText('maria@example.test');

  const statuses = page.getByRole('radiogroup', { name: 'Статус' });
  await expect(statuses.getByRole('radio')).toHaveCount(7);
  await expect(page.getByRole('button', { name: 'Установить статус' })).toBeDisabled();
  await statuses.getByRole('radio', { name: /В отпуске/ }).click();
  await page.getByLabel('Пояснение (необязательно)').fill('По срочным — Петрова');
  await page.getByLabel('Срок').selectOption('date');
  const until = later(7);
  const pad = (value: number) => String(value).padStart(2, '0');
  await page.getByLabel('Включительно по').fill(`${until.getFullYear()}-${pad(until.getMonth() + 1)}-${pad(until.getDate())}`);
  await page.getByRole('button', { name: 'Установить статус' }).click();

  await expect.poll(() => calls.status.length).toBe(1);
  expect(calls.status[0]).toEqual({ kind: 'vacation', text: 'По срочным — Петрова', untilUtc: until.toISOString() });
  const current = page.locator('.profile-current-status');
  await expect(current).toContainText('🌴 В отпуске до');
  await expect(current).toContainText('включительно');
  await expect(current).toContainText('По срочным — Петрова');

  // Свой статус без текста не отправляется.
  await statuses.getByRole('radio', { name: /Свой статус/ }).click();
  await page.getByLabel('Ваш статус').fill('');
  await expect(page.getByRole('button', { name: 'Установить статус' })).toBeDisabled();

  await page.getByRole('button', { name: 'Снять статус' }).click();
  await expect.poll(() => calls.clearedStatus).toBe(1);
  await expect(current).toHaveCount(0);
});

test('an employee changes phones, photo and password in the profile', async ({ page }) => {
  const calls = await mockProfile(page);
  await page.goto('/profile');

  await page.getByLabel('Телефон').fill('+7 913 111-22-33');
  await page.getByLabel('Внутренний номер').fill('205');
  await page.getByRole('button', { name: 'Сохранить контакты' }).click();
  await expect.poll(() => calls.contacts).toEqual([{ phone: '+7 913 111-22-33', internalPhone: '205' }]);

  // Фото: квадрат JPEG, после загрузки — фото в профиле и обновленный аватар в шапке.
  const meBefore = calls.me;
  await page.getByLabel('Файл фото').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: await makePng(page) });
  await expect.poll(() => calls.photo.length).toBe(1);
  expect(calls.photo[0].startsWith('/9j/')).toBe(true);
  await expect(page.getByRole('button', { name: 'Сменить фото' })).toBeVisible();
  await expect(page.locator('.profile-photo .colleague-avatar-photo img')).toHaveAttribute('src', /^blob:/);
  await expect.poll(() => calls.me).toBeGreaterThan(meBefore);
  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Загрузить фото' })).toBeVisible();

  // Пароль: повтор не совпадает — запрос не уходит; неверный текущий — сообщение сервера.
  const submit = page.getByRole('button', { name: 'Изменить пароль' });
  await page.getByLabel('Текущий пароль').fill('неверный');
  await page.getByLabel('Новый пароль', { exact: true }).fill('новый пароль');
  await page.getByLabel('Повторите новый пароль').fill('другой');
  await submit.click();
  await expect(page.locator('.toast', { hasText: 'не совпадают' })).toBeVisible();
  expect(calls.password).toEqual([]);

  await page.getByLabel('Повторите новый пароль').fill('новый пароль');
  await submit.click();
  await expect(page.locator('.toast', { hasText: 'Текущий пароль указан неверно.' })).toBeVisible();

  await page.getByLabel('Текущий пароль').fill('старый');
  await submit.click();
  await expect(page.locator('.toast', { hasText: 'Пароль изменен' })).toBeVisible();
  expect(calls.password).toHaveLength(2);
  await expect(page.getByLabel('Текущий пароль')).toHaveValue('');
});
