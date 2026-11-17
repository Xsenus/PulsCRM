import { expect, test } from '@playwright/test';
import { fulfillJson, regularUser, setupAuthenticatedSession } from './helpers';

const status = {
  version: '1.0.59',
  startedAtUtc: new Date(Date.now() - 3 * 3600_000).toISOString(),
  checkedAtUtc: new Date().toISOString(),
  machineName: 'SERVER2016',
  overall: 'warn',
  checks: [
    { name: 'База Пульса (SQL Server)', status: 'ok', detail: 'Доступна, сотрудников: 27.', durationMs: 12 },
    { name: 'База чата (PostgreSQL)', status: 'ok', detail: 'Доступна, кодировка UTF8.', durationMs: 5 },
    { name: 'Место на диске', status: 'warn', detail: 'Свободно 3 ГБ из 100 ГБ на диске C:\\.', durationMs: 1, hint: 'Освободите место.' },
    { name: 'Резервная копия', status: 'warn', detail: 'Ежедневные копии еще не настроены.', durationMs: 1, hint: 'Выполните команду на сервере.', command: 'powershell -ExecutionPolicy Bypass -File scripts\\register-backup-task.ps1 -At 02:30' }
  ],
  storage: [{ name: 'Вложения чата', path: 'C:\\PulsCRMData\\chat', bytes: 734003200, files: 512 }],
  diskFreeBytes: 3 * 1024 ** 3,
  diskTotalBytes: 100 * 1024 ** 3,
  queueDepth: 4,
  failedLast24Hours: 1,
  sentLast24Hours: 120,
  pushSubscriptions: 6,
  logDirectory: 'C:\\PulsCRMData\\logs',
  logFiles: ['api-20261116.log', 'api-20261115.log'],
  recentProblems: [
    { timestampUtc: new Date().toISOString(), level: 'Error', category: 'PulsNext.Api.Errors', message: 'Необработанная ошибка запроса 0HNQ:1', exception: 'System.Exception: тест' },
    { timestampUtc: new Date().toISOString(), level: 'Warning', category: 'PulsNext.Infrastructure', message: `Очень длинное сообщение журнала ${'без пробелов_'.repeat(30)} конец`, exception: null },
    { timestampUtc: new Date().toISOString(), level: 'Warning', category: 'PulsNext.Infrastructure.HttpWebPushSender', message: 'Web Push: сервис fcm.googleapis.com ответил 403.', exception: null }
  ]
};

test('administrator sees system status, problems and can download a log file', async ({ page }) => {
  await setupAuthenticatedSession(page);
  await page.route(/\/api\/chat\/status$/, (route) => fulfillJson(route, { enabled: false }));
  await page.route(/\/api\/diagnostics\/status$/, (route) => fulfillJson(route, status));
  await page.route(/\/api\/diagnostics\/logs\/api-20261116\.log$/, (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: 'log line' }));
  await page.goto('/system');

  await expect(page.getByRole('heading', { name: 'Состояние системы' })).toBeVisible();
  // Итог: сколько в порядке и сколько требуют внимания.
  const summary = page.getByRole('status', { name: 'Итог проверки' });
  await expect(summary).toContainText('Нужно внимание');
  await expect(summary).toContainText('2 проверки в порядке · 2 требуют внимания');

  // Замечания — сверху, с подсказкой и готовой командой, которую можно скопировать.
  const issues = page.getByRole('region', { name: 'Требует внимания' });
  await expect(issues.locator('.sys-issue')).toHaveCount(2);
  const backup = issues.locator('.sys-issue', { hasText: 'Резервная копия' });
  await expect(backup.locator('code')).toHaveText('powershell -ExecutionPolicy Bypass -File scripts\\register-backup-task.ps1 -At 02:30');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await backup.getByRole('button', { name: 'Копировать' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('register-backup-task.ps1');

  // Пройденные проверки — плитками.
  await expect(page.getByRole('region', { name: /В порядке/ }).locator('.sys-check')).toHaveText([/База Пульса/, /База чата/]);
  await expect(page.locator('.sys-storage')).toContainText('700 МБ');
  await expect(page.locator('.sys-disk')).toContainText(/Свободно 3(,0)? ГБ из 100 ГБ/);
  await expect(page.locator('.stat-card', { hasText: 'Подписок на уведомления' })).toContainText('6');

  // Длинное сообщение журнала переносится и не растягивает страницу.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

  // Подробности ошибки раскрываются по клику.
  await page.locator('.sys-problem-head', { hasText: 'Необработанная ошибка' }).click();
  await expect(page.locator('.sys-problem-details')).toContainText('System.Exception: тест');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Скачать api-20261116.log' }).click()
  ]);
  expect(download.suggestedFilename()).toBe('api-20261116.log');
});

test('the status page is admin only', async ({ page }) => {
  await setupAuthenticatedSession(page, regularUser);
  await page.route(/\/api\/chat\/status$/, (route) => fulfillJson(route, { enabled: false }));
  await page.route(/\/api\/colleagues$/, (route) => fulfillJson(route, []));
  await page.goto('/system');
  await expect(page).toHaveURL(/\/$/);
});
