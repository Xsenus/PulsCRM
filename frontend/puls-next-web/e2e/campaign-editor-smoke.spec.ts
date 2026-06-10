import { expect, test } from '@playwright/test';
import {
  expectNoDocumentHorizontalOverflow,
  fulfillJson,
  mainTransportProfile,
  mockTransportProfiles,
  setupAuthenticatedSession
} from './helpers';

const recipientPreview = {
  organizationCount: 0,
  recipientCount: 1,
  items: [
    {
      legacyOrgId: 0,
      legacyOrgName: 'Manual recipients',
      email: 'manual@example.test',
      displayName: 'Manual Recipient',
      sourceKind: 7
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
});

test('new campaign editor previews recipients, readiness and schedule', async ({ page }) => {
  await page.goto('/campaigns/new');

  await expect(page.locator('.app-shell')).toBeVisible();
  await expect(page.locator('.campaign-editor-tabs')).toBeVisible();

  await page.locator('.campaign-main-grid .form-input').nth(0).fill('Smoke Campaign');
  await page.locator('.campaign-main-grid .form-input').nth(1).fill('Smoke subject');
  await page.locator('.campaign-main-grid .form-select').nth(1).selectOption(String(mainTransportProfile.id));

  await page.getByRole('tab').nth(2).click();
  await page.locator('.form-textarea-code').fill('<p>Hello from smoke test</p>');
  await page.locator('textarea').last().fill('Hello from smoke test');

  await page.getByRole('tab').nth(1).click();
  await page.locator('textarea').last().fill('manual@example.test');
  await page.locator('.page-header-actions .secondary-button').nth(0).click();

  await expect(page.getByText('manual@example.test').first()).toBeVisible();
  await expect(page.getByText('Manual Recipient').first()).toBeVisible();

  await page.locator('.page-header-actions .secondary-button').nth(1).click();

  await expect(page.locator('.campaign-readiness-panel')).toBeVisible();
  await expect(page.getByText('Transport profile').first()).toBeVisible();
  await expect(page.getByText('One recipient is ready.').first()).toBeVisible();

  await page.getByRole('tab').nth(3).click();
  await page.locator('.row-actions .secondary-button').click();

  await expect(page.locator('.schedule-preview-item')).toHaveCount(2);
  await expect.poll(() => expectNoDocumentHorizontalOverflow(page)).toBe(true);
});
