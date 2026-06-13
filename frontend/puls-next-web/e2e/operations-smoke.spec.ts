import { expect, test } from '@playwright/test';
import {
  expectNoDocumentHorizontalOverflow,
  fulfillJson,
  mainTransportProfile,
  mockTransportProfiles,
  setupAuthenticatedSession
} from './helpers';

const now = '2026-06-10T12:00:00Z';

const campaignsResponse = {
  items: [
    {
      id: 301,
      name: 'Monthly Digest',
      subject: 'June CRM digest',
      status: 1,
      scheduleKind: 2,
      timeZoneId: 'Asia/Novosibirsk',
      nextRunAtUtc: '2026-06-11T03:00:00Z',
      lastRunAtUtc: '2026-06-09T03:00:00Z',
      targetOrganizationsCount: 12,
      attachmentsCount: 1,
      transportProfileName: 'Main SMTP',
      createdAtUtc: now,
      updatedAtUtc: now
    }
  ],
  totalCount: 1
};

let campaignRequestUrls: string[] = [];

const dispatchItemsResponse = {
  items: [
    {
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
    }
  ],
  totalCount: 1
};

const dispatchBatchesResponse = {
  items: [
    {
      id: 501,
      triggerKind: 1,
      triggerComment: 'Manual smoke batch',
      scheduledAtUtc: '2026-06-10T10:00:00Z',
      createdAtUtc: '2026-06-10T10:00:10Z',
      completedAtUtc: '2026-06-10T10:03:00Z',
      totalRecipients: 10,
      queuedCount: 0,
      processingCount: 0,
      sentCount: 8,
      failedCount: 2,
      cancelledCount: 0,
      correlationId: 'batch-501'
    }
  ],
  totalCount: 1
};

test.beforeEach(async ({ page }) => {
  await setupAuthenticatedSession(page);
  await mockTransportProfiles(page);
  campaignRequestUrls = [];

  await page.route(/\/api\/campaigns(?:\?.*)?$/, async (route) => {
    campaignRequestUrls.push(route.request().url());
    await fulfillJson(route, campaignsResponse);
  });

  await page.route(/\/api\/dispatch\/items(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, dispatchItemsResponse);
  });

  await page.route(/\/api\/dispatch\/batches(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, dispatchBatchesResponse);
  });

});

test('campaigns list opens with campaign data', async ({ page }) => {
  await page.goto('/campaigns');

  await expect(page.locator('.app-shell')).toBeVisible();
  await expect(page.locator('.data-table')).toBeVisible();
  await expect(page.getByText('Monthly Digest').first()).toBeVisible();
  await expect(page.getByText('June CRM digest').first()).toBeVisible();
  await expect(page.getByText('Main SMTP').first()).toBeVisible();
});

test('campaigns quick status filter reloads list with status parameter', async ({ page }) => {
  await page.goto('/campaigns');

  await expect(page.getByText('Monthly Digest').first()).toBeVisible();

  await page.locator('.campaign-status-filter-button').filter({ hasText: 'Активна' }).click();

  await expect.poll(() => {
    const lastUrl = campaignRequestUrls.at(-1);
    return lastUrl ? new URL(lastUrl).searchParams.get('status') : null;
  }).toBe('1');

  await page.locator('.campaign-status-filter-button').filter({ hasText: 'Все' }).click();

  await expect.poll(() => {
    const lastUrl = campaignRequestUrls.at(-1);
    return lastUrl ? new URL(lastUrl).searchParams.get('status') : 'missing';
  }).toBeNull();
});

test('dispatch diagnostics opens items and batches', async ({ page }) => {
  await page.goto('/dispatch');

  await expect(page.locator('.app-shell')).toBeVisible();
  await expect(page.getByText('recipient@example.test').first()).toBeVisible();
  await expect(page.getByText('SMTP timeout').first()).toBeVisible();

  await page.locator('.settings-tab').filter({ hasText: /./ }).nth(1).click();

  await expect(page.getByText('501').first()).toBeVisible();
  await expect(page.getByText('8/10').first()).toBeVisible();
});

test('settings smtp list fits mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/settings');

  await expect(page.locator('.app-shell')).toBeVisible();
  const smtpCard = page.locator('.data-table-card').filter({ hasText: mainTransportProfile.name });
  await expect(smtpCard).toBeVisible();
  await expect(smtpCard).toContainText(mainTransportProfile.host);
  await expect.poll(() => expectNoDocumentHorizontalOverflow(page)).toBe(true);
});
