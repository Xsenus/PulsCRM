import { expect, test, type Page } from '@playwright/test';
import { currentUser, fulfillJson, regularUser, setupAuthenticatedSession } from './helpers';

// Прозрачный PNG 1×1.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

function soon(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return { birthdayMonth: date.getMonth() + 1, birthdayDay: date.getDate() };
}

const colleagues = [
  { id: 2, fullName: 'Петрова Анна Сергеевна', position: 'Главный бухгалтер', department: 'Бухгалтерия', email: 'petrova@example.test', phone: '+7 900 111-22-33', internalPhone: '201', ...soon(0), hasPhoto: true, isMale: false },
  { id: 3, fullName: 'Иванов Олег Петрович', position: 'Менеджер', department: 'Продажи', email: 'ivanov@example.test', phone: null, internalPhone: null, ...soon(5), hasPhoto: false, isMale: true,
    status: { kind: 'meeting', text: 'Вернусь к 15:00', untilUtc: null } },
  { id: 4, fullName: 'Сидорова Ольга', position: 'Юрист', department: 'Юридический отдел', email: null, phone: null, internalPhone: null, birthdayMonth: null, birthdayDay: null, hasPhoto: false, isMale: false }
];

async function mockApp(page: Page, user: typeof currentUser) {
  const calls = { dashboard: 0, adminApi: [] as string[] };
  await setupAuthenticatedSession(page, user);
  await page.addInitScript(() => window.localStorage.removeItem('puls-chat-dock'));
  await page.route(/\/hubs\/chat/, (route) => route.fulfill({ status: 503, body: '' }));
  await page.route(/\/api\/chat\/status$/, (route) => fulfillJson(route, { enabled: true, currentUserId: user.id, maxAttachmentBytes: 26214400, maxAttachmentsPerMessage: 10, maxMessageLength: 8000 }));
  await page.route(/\/api\/chat\/settings$/, (route) => fulfillJson(route, { notificationsEnabled: true, soundEnabled: false, soundName: 'chime', soundVolume: 70, showMessagePreview: true }));
  await page.route(/\/api\/chat\/dock$/, (route) => fulfillJson(route, { open: false, conversationId: null, width: null, height: null }));
  await page.route(/\/api\/chat\/conversations(\?.*)?$/, (route) => fulfillJson(route, []));
  await page.route(/\/api\/colleagues$/, (route) => fulfillJson(route, colleagues));
  await page.route(/\/api\/colleagues\/(\d+)$/, (route) => {
    const id = Number(/\/(\d+)$/.exec(route.request().url())![1]);
    const found = colleagues.find((item) => item.id === id);
    return found ? fulfillJson(route, found) : route.fulfill({ status: 404, body: '' });
  });
  await page.route(/\/api\/colleagues\/\d+\/photo$/, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.route(/\/api\/dashboard$/, (route) => {
    calls.dashboard += 1;
    return fulfillJson(route, { employees: 3, organizations: 2806, activeCampaigns: 1, queueDepth: 0, sentLast24Hours: 5, failedLast24Hours: 0 });
  });
  await page.route(/\/api\/(campaigns|organizations|dispatch|transport-profiles|analytics)(\/.*)?(\?.*)?$/, (route) => {
    calls.adminApi.push(route.request().url());
    return route.fulfill({ status: 403, body: '' });
  });
  await page.route(/\/api\/employees(\?.*)?$/, (route) => fulfillJson(route, {
    totalCount: 1,
    items: [{ id: 2, login: 'petrova', fullName: 'Петрова Анна Сергеевна', userGroup: 'Бухгалтерия', isRoot: false, isMale: false, isDismissed: false }]
  }));
  return calls;
}

test('an employee sees only the dashboard, chat and colleagues', async ({ page }) => {
  const calls = await mockApp(page, regularUser);
  await page.goto('/');

  const menu = page.locator('nav.menu');
  await expect(menu.locator('.menu-link-label')).toHaveText(['Дашборд', 'Чат', 'Сотрудники']);

  // Дашборд: приветствие, дни рождения, быстрые ссылки; показатели рассылок не запрашиваются.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Мария!');
  const birthdays = page.getByRole('region', { name: 'Дни рождения' });
  await expect(birthdays.locator('.home-list-title')).toHaveText(['🎉 Петрова Анна Сергеевна', 'Иванов Олег Петрович']);
  await expect(birthdays).toContainText('Сегодня');
  await expect(birthdays.getByRole('button', { name: 'Поздравить' })).toHaveCount(2);
  await expect(page.locator('.home-links a')).toHaveText([/Чат/, /Сотрудники/]);
  await expect(page.getByRole('heading', { level: 2, name: 'Рассылки' })).toHaveCount(0);
  expect(calls.dashboard).toBe(0);

  // Прямые ссылки на разделы администрирования ведут на дашборд.
  for (const path of ['/campaigns', '/organizations', '/dispatch', '/settings', '/analytics/parus-tornado', '/employees/2/edit']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/$/);
  }

  expect(calls.adminApi).toEqual([]);
});

test('an employee sees colleagues as cards with contacts and search', async ({ page }) => {
  await mockApp(page, regularUser);
  await page.goto('/employees');

  await expect(page.getByRole('tablist', { name: 'Вид списка сотрудников' })).toHaveCount(0);
  const cards = page.locator('.colleague-card');
  await expect(cards).toHaveCount(3);
  // Три карточки в ряд на обычном экране.
  const tops = await cards.evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  const petrova = page.getByRole('article', { name: 'Петрова Анна Сергеевна' });
  await expect(petrova).toContainText('Главный бухгалтер');
  await expect(petrova).toContainText('Бухгалтерия');
  await expect(petrova.getByRole('link', { name: '+7 900 111-22-33' })).toHaveAttribute('href', 'tel:+79001112233');
  await expect(petrova.getByRole('link', { name: 'petrova@example.test' })).toHaveAttribute('href', 'mailto:petrova@example.test');
  await expect(petrova).toContainText('201');
  await expect(petrova.locator('.colleague-avatar-photo img')).toHaveAttribute('src', /^blob:/);
  await expect(petrova.getByRole('button', { name: /Написать/ })).toBeVisible();

  // Статус из «Моего профиля» виден в карточке.
  const ivanov = page.getByRole('article', { name: 'Иванов Олег Петрович' });
  await expect(ivanov.locator('.colleague-card-user-status')).toContainText('📅 На совещании');
  await expect(ivanov.locator('.colleague-card-user-status')).toContainText('Вернусь к 15:00');
  await expect(petrova.locator('.colleague-card-user-status')).toHaveCount(0);

  await page.getByLabel('Поиск сотрудников').fill('юрист');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Сидорова Ольга');

  await page.getByLabel('Поиск сотрудников').fill('');
  await page.getByLabel('Отдел').selectOption('Продажи');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Иванов Олег Петрович');
});

test('an administrator keeps every section, the table and can switch to cards', async ({ page }) => {
  const calls = await mockApp(page, currentUser);
  await page.goto('/');

  await expect(page.locator('nav.menu .menu-link-label')).toHaveText(['Дашборд', 'Чат', 'Сотрудники', 'Аналитика', 'Организации', 'Рассылки', 'Очередь', 'Настройки', 'Состояние системы']);
  await expect(page.getByRole('heading', { level: 2, name: 'Рассылки' })).toBeVisible();
  await expect(page.getByText('2806')).toBeVisible();
  expect(calls.dashboard).toBeGreaterThanOrEqual(1);

  await page.goto('/employees');
  const switcher = page.getByRole('tablist', { name: 'Вид списка сотрудников' });
  await expect(switcher.getByRole('tab', { name: 'Таблица' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.colleague-card')).toHaveCount(0);

  await switcher.getByRole('tab', { name: 'Карточки' }).click();
  await expect(page.locator('.colleague-card')).toHaveCount(3);

  // Выбор вида запоминается.
  await page.reload();
  await expect(page.locator('.colleague-card')).toHaveCount(3);
});

test('the colleague card opens from employees and the dashboard', async ({ page }) => {
  await mockApp(page, regularUser);
  await page.goto('/employees');

  await page.getByRole('article', { name: 'Иванов Олег Петрович' }).getByRole('button', { name: 'Иванов Олег Петрович' }).click();
  const dialog = page.getByRole('dialog', { name: 'Карточка сотрудника' });
  await expect(dialog.getByRole('heading', { name: 'Иванов Олег Петрович' })).toBeVisible();
  await expect(dialog).toContainText('Менеджер');
  await expect(dialog).toContainText('Продажи');
  await expect(dialog.locator('.colleague-card-user-status')).toContainText('📅 На совещании');
  await expect(dialog.getByRole('link', { name: 'ivanov@example.test' })).toHaveAttribute('href', 'mailto:ivanov@example.test');
  await expect(dialog.getByRole('button', { name: /Написать/ })).toBeVisible();
  // Обычному сотруднику полная карточка (редактирование) недоступна.
  await expect(dialog.getByRole('button', { name: 'Редактировать' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.goto('/');
  await page.getByRole('region', { name: 'Дни рождения' }).getByRole('button', { name: /Петрова Анна Сергеевна/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Петрова Анна Сергеевна' })).toBeVisible();
  await expect(dialog.getByRole('link', { name: '+7 900 111-22-33' })).toHaveAttribute('href', 'tel:+79001112233');
  await expect(dialog).toContainText('201');
  await expect(dialog.locator('.colleague-avatar-photo img')).toHaveAttribute('src', /^blob:/);
});

test('an administrator can open the full employee card from the colleague card', async ({ page }) => {
  await mockApp(page, currentUser);
  await page.goto('/');
  await page.getByRole('region', { name: 'Дни рождения' }).getByRole('button', { name: /Иванов Олег Петрович/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Карточка сотрудника' });
  await dialog.getByRole('button', { name: 'Редактировать' }).click();
  await expect(page).toHaveURL(/\/employees\/3\/edit$/);
  await expect(dialog).toHaveCount(0);
});
