import { expect, test } from '@playwright/test';
import {
  expectNoDocumentHorizontalOverflow,
  fulfillJson,
  mainTransportProfile,
  mockTransportProfiles,
  setupAuthenticatedSession
} from './helpers';

const recipientPreview = {
  organizationCount: 1,
  recipientCount: 3,
  items: [
    {
      legacyOrgId: 0,
      legacyOrgName: 'Manual recipients',
      email: 'manual@example.test',
      displayName: 'Manual Recipient',
      sourceKind: 0
    },
    {
      legacyOrgId: 201,
      legacyOrgName: 'Mobile Org',
      email: 'primary@example.test',
      displayName: 'Mobile Org',
      sourceKind: 1
    },
    {
      legacyOrgId: 201,
      legacyOrgName: 'Mobile Org',
      email: 'contact@example.test',
      displayName: 'Contact Person',
      sourceKind: 2
    }
  ]
};

const readinessResponse = {
  isReady: true,
  organizationCount: 0,
  recipientCount: 1,
  items: [
    {
      key: 'transport-profile',
      label: 'Transport profile',
      status: 'ok',
      message: 'Main SMTP is configured.',
      isBlocking: false
    },
    {
      key: 'recipients',
      label: 'Recipients',
      status: 'ok',
      message: 'One recipient is ready.',
      isBlocking: false
    }
  ]
};

const schedulePreview = [
  {
    utc: '2026-06-11T03:00:00Z',
    local: '2026-06-11T10:00:00+07:00'
  },
  {
    utc: '2026-06-12T03:00:00Z',
    local: '2026-06-12T10:00:00+07:00'
  }
];

const existingCampaign = {
  id: 301,
  name: 'Monthly Digest',
  subject: 'June CRM digest',
  htmlBody: '<p>Monthly update</p>',
  plainTextBody: 'Monthly update',
  status: 1,
  transportProfileId: mainTransportProfile.id,
  transportProfileName: mainTransportProfile.name,
  scheduleKind: 2,
  cronExpression: '',
  timeZoneId: 'Asia/Novosibirsk',
  startAtUtc: '2026-06-10T12:00:00Z',
  endAtUtc: null,
  intervalMinutes: 15,
  randomIntervalMinMinutes: 1,
  randomIntervalMaxMinutes: 5,
  nextRunAtUtc: '2026-06-11T03:00:00Z',
  lastRunAtUtc: '2026-06-09T03:00:00Z',
  lastRunStartedAtUtc: '2026-06-09T03:00:00Z',
  lastRunFinishedAtUtc: '2026-06-09T03:05:00Z',
  maxRecipientsPerRun: 0,
  maxAttempts: 3,
  useOrgPrimaryEmail: true,
  useContactEmails: false,
  useSalaryEmail: false,
  useOneCEmail: false,
  useSiteEmail: false,
  useDirectorEmail: false,
  manualRecipientsCsv: 'recipient@example.test',
  targets: [],
  attachments: [],
  createdAtUtc: '2026-06-10T12:00:00Z',
  updatedAtUtc: '2026-06-10T12:00:00Z'
};

const failedDispatchItem = {
  id: 401,
  legacyOrgId: 201,
  legacyOrgName: 'Mobile Org',
  recipientEmail: 'recipient@example.test',
  recipientDisplayName: 'Recipient One',
  sourceKind: 1,
  status: 3,
  attemptCount: 2,
  queuedAtUtc: '2026-06-10T10:00:00Z',
  startedAtUtc: '2026-06-10T10:01:00Z',
  failedAtUtc: '2026-06-10T10:02:00Z',
  nextAttemptAtUtc: '2026-06-10T10:10:00Z',
  errorMessage: 'SMTP timeout',
  smtpResponse: '421 Timeout',
  messageId: 'message-401'
};

const campaignStats = {
  campaignId: 301,
  totalItems: 1,
  queued: 0,
  processing: 0,
  sent: 0,
  failed: 1,
  deferred: 0,
  cancelled: 0,
  lastBatchScheduledAtUtc: '2026-06-10T10:00:00Z',
  lastBatchCompletedAtUtc: null,
  recentBatches: [
    {
      id: 501,
      triggerKind: 1,
      triggerComment: 'Manual smoke batch',
      scheduledAtUtc: '2026-06-10T10:00:00Z',
      createdAtUtc: '2026-06-10T10:00:10Z',
      completedAtUtc: null,
      totalRecipients: 1,
      queuedCount: 0,
      processingCount: 0,
      sentCount: 0,
      failedCount: 1,
      cancelledCount: 0,
      correlationId: 'batch-501'
    }
  ],
  recentItems: [failedDispatchItem],
  failedItems: [failedDispatchItem],
  deferredItems: []
};

test.beforeEach(async ({ page }) => {
  await setupAuthenticatedSession(page);
  await mockTransportProfiles(page);

  await page.route(/\/api\/campaigns\/preview-recipients$/, async (route) => {
    await fulfillJson(route, recipientPreview);
  });

  await page.route(/\/api\/campaigns\/readiness$/, async (route) => {
    await fulfillJson(route, readinessResponse);
  });

  await page.route(/\/api\/campaigns\/preview-schedule$/, async (route) => {
    await fulfillJson(route, schedulePreview);
  });

  await page.route(/\/api\/campaigns\/301$/, async (route) => {
    await fulfillJson(route, existingCampaign);
  });

  await page.route(/\/api\/campaigns\/301\/stats$/, async (route) => {
    await fulfillJson(route, campaignStats);
  });
});

test('new campaign editor previews recipients, readiness and schedule', async ({ page }) => {
  await page.goto('/campaigns/new');

  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.campaign-editor-tabs')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => page.locator('.campaign-editor-tabs [role="tab"]').evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute('aria-label')))).toEqual([
    'Основное: текущий раздел',
    'Получатели: открыть раздел',
    'Письмо: открыть раздел',
    'Расписание: открыть раздел',
    'Проверка и запуск: открыть раздел',
    'Статистика: открыть раздел'
  ]);

  await page.locator('.campaign-main-grid .form-input').nth(0).fill('Smoke Campaign');
  await page.locator('.campaign-main-grid .form-input').nth(1).fill('Smoke subject');
  await page.locator('.campaign-main-grid .form-select').nth(1).selectOption(String(mainTransportProfile.id));

  await page.getByRole('tab').nth(2).click();
  await page.getByRole('button', { name: 'Вставить шаблон' }).click();
  await expect(page.locator('.form-textarea-code')).toHaveValue(/Подготовили для вас важную информацию\./);
  await expect(page.locator('textarea').last()).toHaveValue(/Подготовили для вас важную информацию\./);
  await page.locator('.form-textarea-code').fill('<p>Hello from smoke test</p>');
  await page.locator('textarea').last().fill('Hello from smoke test');

  await page.getByRole('tab').nth(1).click();
  await expect(page.getByLabel('Использовать основной email организации для рассылки')).toBeChecked();
  await expect(page.getByLabel('Использовать адреса контактов для рассылки')).not.toBeChecked();
  await expect(page.getByLabel('Использовать email зарплатного сопровождения для рассылки')).not.toBeChecked();
  await expect(page.getByLabel('Использовать email 1C для рассылки')).not.toBeChecked();
  await expect(page.getByLabel('Использовать email сайта для рассылки')).not.toBeChecked();
  await expect(page.getByLabel('Использовать email руководителя для рассылки')).not.toBeChecked();
  await page.getByLabel('Ручные адреса получателей рассылки').fill('manual@example.test');
  await page.locator('.page-header-actions .secondary-button').nth(0).click();

  await expect(page.getByText('manual@example.test').first()).toBeVisible();
  await expect(page.getByText('Manual Recipient').first()).toBeVisible();
  await expect(page.locator('.recipient-source-summary')).toContainText('Вручную');
  await expect(page.locator('.recipient-source-summary')).toContainText('Основной адрес организации');
  await expect(page.locator('.recipient-source-summary')).toContainText('Контактное лицо');

  await page.locator('.page-header-actions .secondary-button').nth(1).click();

  await expect(page.locator('.campaign-readiness-panel')).toBeVisible();
  await expect(page.getByText('Transport profile').first()).toBeVisible();
  await expect(page.getByText('One recipient is ready.').first()).toBeVisible();

  await page.getByRole('tab').nth(3).click();
  await page.locator('.row-actions .secondary-button').click();

  await expect(page.locator('.schedule-preview-item')).toHaveCount(2);
  await expect.poll(() => expectNoDocumentHorizontalOverflow(page)).toBe(true);
});

test('existing campaign stats show problem attempt diagnostics', async ({ page }) => {
  await page.goto('/campaigns/301');

  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('tab', { name: 'Статистика' }).click();
  await expect.poll(() => page.locator('.campaign-editor-tabs [role="tab"]').evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute('aria-label')))).toEqual([
    'Основное: открыть раздел',
    'Получатели: открыть раздел',
    'Письмо: открыть раздел',
    'Расписание: открыть раздел',
    'Проверка и запуск: открыть раздел',
    'Статистика: текущий раздел'
  ]);

  const problemList = page.locator('.campaign-problem-list');
  await expect(problemList).toContainText('recipient@example.test');
  await expect(problemList).toContainText('SMTP timeout');
  await expect(problemList).toContainText('2 попытки');
  await expect(problemList).toContainText('Следующая попытка');
  await expect(problemList).toContainText('SMTP: 421 Timeout');
  await expect.poll(() => expectNoDocumentHorizontalOverflow(page)).toBe(true);
});
