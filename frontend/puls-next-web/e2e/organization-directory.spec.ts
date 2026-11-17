import { expect, test, type Page } from '@playwright/test';
import { currentUser, fulfillJson, regularUser, setupAuthenticatedSession } from './helpers';

const organizations = Array.from({ length: 30 }, (_, index) => ({
  id: index + 1,
  name: index === 0 ? 'ООО «Ромашка»' : `Организация ${String(index + 1).padStart(2, '0')}`,
  inn: index === 0 ? '5401000001' : `54${String(index).padStart(8, '0')}`,
  raion: index === 0 ? 'Центральный' : 'Ленинский',
  phone: index === 0 ? '+7 383 111-22-33' : null,
  email: index === 0 ? 'info@romashka.test' : null
}));

const romashkaCard = {
  id: 1,
  name: 'ООО «Ромашка»',
  fullName: 'Общество с ограниченной ответственностью «Ромашка»',
  inn: '5401000001',
  kpp: '540101001',
  ogrn: '1025400000001',
  raion: 'Центральный',
  orgType: 'Коммерческая',
  addressLegal: 'г. Новосибирск, ул. Ленина, 1',
  addressActual: 'г. Новосибирск, ул. Ленина, 1',
  phone: '+7 383 111-22-33 доб. 5',
  site: 'romashka.test',
  emails: [{ label: 'Основной', email: 'info@romashka.test' }, { label: 'Зарплата', email: 'zp@romashka.test' }],
  directorName: 'Петров Петр Петрович',
  directorPosition: 'Директор',
  directorPhone: '+7 900 000-00-01',
  contacts: [{ fio: 'Сидорова Анна', position: 'Бухгалтер', phone: '+7 900 000-00-02', email: 'anna@romashka.test' }]
};

async function mockApp(page: Page, user: typeof currentUser) {
  const searches: string[] = [];
  await setupAuthenticatedSession(page, user);
  await page.addInitScript(() => window.localStorage.removeItem('puls-chat-dock'));
  await page.route(/\/hubs\/chat/, (route) => route.fulfill({ status: 503, body: '' }));
  await page.route(/\/api\/chat\/status$/, (route) => fulfillJson(route, { enabled: true, currentUserId: user.id, maxAttachmentBytes: 26214400, maxAttachmentsPerMessage: 10, maxMessageLength: 8000 }));
  await page.route(/\/api\/chat\/settings$/, (route) => fulfillJson(route, { notificationsEnabled: true, soundEnabled: false, soundName: 'chime', soundVolume: 70, showMessagePreview: true }));
  await page.route(/\/api\/chat\/dock$/, (route) => fulfillJson(route, { open: false, conversationId: null, width: null, height: null }));
  await page.route(/\/api\/colleagues$/, (route) => fulfillJson(route, []));
  await page.route(/\/api\/organization-directory(\?.*)?$/, (route) => {
    const url = new URL(route.request().url());
    const search = (url.searchParams.get('search') ?? '').toLowerCase();
    searches.push(search);
    const skip = Number(url.searchParams.get('skip') ?? 0);
    const take = Number(url.searchParams.get('take') ?? 25);
    const found = organizations.filter((item) => !search || item.name.toLowerCase().includes(search) || item.inn.includes(search));
    return fulfillJson(route, { items: found.slice(skip, skip + take), totalCount: found.length });
  });
  await page.route(/\/api\/organization-directory\/1$/, (route) => fulfillJson(route, romashkaCard));
  return searches;
}

test('an employee finds an organization in the read-only directory and sees its contacts', async ({ page }) => {
  const searches = await mockApp(page, regularUser);
  await page.goto('/');
  await page.locator('nav.menu').getByRole('link', { name: 'Организации' }).click();
  await expect(page).toHaveURL(/\/directory\/organizations$/);
  await expect(page.locator('.page-header h1')).toHaveText('Организации');

  const list = page.getByRole('list', { name: 'Организации' });
  await expect(list.getByRole('listitem')).toHaveCount(25);
  await expect(page.locator('.pagination')).toBeVisible();

  await page.getByLabel('Поиск организаций').fill('ромаш');
  await expect(list.getByRole('listitem')).toHaveCount(1);
  // Поиск уходит один раз после паузы в наборе, а не на каждую букву.
  expect(searches.filter((value) => value.startsWith('р'))).toEqual(['ромаш']);
  const item = list.getByRole('listitem').first();
  await expect(item).toContainText('ИНН 5401000001 · Центральный');
  await expect(item).toContainText('+7 383 111-22-33');
  await item.getByRole('button').click();

  const card = page.getByRole('dialog', { name: 'ООО «Ромашка»' });
  await expect(page).toHaveURL(/open=1/);
  await expect(card).toContainText('Общество с ограниченной ответственностью «Ромашка»');
  await expect(card).toContainText('540101001');
  await expect(card.getByRole('link', { name: '+7 383 111-22-33 доб. 5' })).toHaveAttribute('href', 'tel:+73831112233');
  await expect(card.getByRole('link', { name: 'zp@romashka.test' })).toHaveAttribute('href', 'mailto:zp@romashka.test');
  await expect(card.getByRole('link', { name: 'romashka.test', exact: true })).toHaveAttribute('href', 'https://romashka.test');
  await expect(card.getByRole('region', { name: 'Руководитель' })).toContainText('Петров Петр Петрович');
  await expect(card.getByRole('region', { name: 'Контактные лица' })).toContainText('Сидорова Анна');
  // Факт. адрес совпадает с юридическим — второй раз не показывается; полной карточки сотруднику нет.
  await expect(card).not.toContainText('Факт. адрес');
  await expect(card.getByRole('button', { name: 'Полная карточка' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await expect(page).not.toHaveURL(/open=/);
});

test('the directory is not in the administrator menu, but the card offers the full editor', async ({ page }) => {
  await mockApp(page, currentUser);
  await page.goto('/directory/organizations?open=1');
  await expect(page.locator('nav.menu').getByRole('link', { name: 'Организации' })).toHaveAttribute('href', '/organizations');
  const card = page.getByRole('dialog', { name: 'ООО «Ромашка»' });
  await card.getByRole('button', { name: 'Полная карточка' }).click();
  await expect(page).toHaveURL(/\/organizations\/1\/edit$/);
});

test('a link to an organization in the chat opens the directory card for an employee', async ({ page, baseURL }) => {
  await mockApp(page, regularUser);
  const participants = [
    { userId: regularUser.id, displayName: regularUser.fullName, role: 0, isInactive: false, lastReadMessageId: 0 },
    { userId: 2, displayName: 'Петрова Анна Сергеевна', role: 0, isInactive: false, lastReadMessageId: 0 }
  ];
  await page.route(/\/api\/chat\/conversations(\?.*)?$/, (route) => fulfillJson(route, [
    { id: 10, kind: 0, title: 'Петрова Анна Сергеевна', peerUserId: 2, myRole: 0, isMuted: false, isPinned: false, isArchived: false, unreadCount: 0, myLastReadMessageId: 0,
      createdAtUtc: new Date().toISOString(), lastMessageAtUtc: new Date().toISOString(), participants }
  ]));
  await page.route(/\/api\/chat\/conversations\/10\/messages(\?.*)?$/, (route) => fulfillJson(route, {
    items: [{ id: 1, conversationId: 10, kind: 0, senderUserId: 2, senderName: 'Петрова Анна Сергеевна', text: `Клиент: ${baseURL}/organizations/1/edit`, createdAtUtc: new Date().toISOString(), isDeleted: false, attachments: [], reactions: [] }],
    hasMoreBefore: false
  }));
  await page.route(/\/api\/chat\/conversations\/\d+\/read$/, (route) => route.fulfill({ status: 204 }));
  // Полная карточка организации сотруднику закрыта.
  await page.route(/\/api\/organizations\/1$/, (route) => route.fulfill({ status: 403, body: '' }));

  await page.goto('/chat/10');
  const preview = page.locator('.chat-link-preview');
  await expect(preview).toContainText('ООО «Ромашка»');
  await expect(preview).toContainText('ИНН 5401000001');
  await preview.click();
  await expect(page).toHaveURL(/\/directory\/organizations\?open=1$/);
  await expect(page.getByRole('dialog', { name: 'ООО «Ромашка»' })).toContainText('Сидорова Анна');
});
