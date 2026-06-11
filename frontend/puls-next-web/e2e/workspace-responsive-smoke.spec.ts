import { expect, test } from '@playwright/test';
import {
  expectNoDocumentHorizontalOverflow,
  fulfillJson,
  mainTransportProfile,
  mockTransportProfiles,
  setupAuthenticatedSession
} from './helpers';

const viewports = [
  { name: 'narrow-mobile', width: 360, height: 740 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1366, height: 768 },
  { name: 'wide-desktop', width: 1920, height: 1080 }
];

const dashboardResponse = {
  employees: 28,
  organizations: 2796,
  activeCampaigns: 2,
  queueDepth: 4,
  sentLast24Hours: 12,
  failedLast24Hours: 1
};

const employeesResponse = {
  items: [
    {
      id: 101,
      login: 'employee.demo',
      fullName: 'Demo Employee',
      userGroup: 'Sales',
      ruleName: 'Default',
      privacyGroupName: 'Public',
      email: 'employee@example.test',
      phone: '+7 111 111-11-11',
      phoneWorkRedirect: '101',
      site: 'https://example.test',
      address: 'Test street 1',
      position: 'Manager',
      icq: '',
      skype: '',
      comment: '',
      s1cCode: 'EMP-101',
      birthDay: '1990-01-01T00:00:00',
      isRoot: false,
      isMale: true,
      isDismissed: false
    }
  ],
  totalCount: 1
};

const organizationsResponse = {
  items: [
    {
      id: 201,
      name: 'Mobile Org',
      smallName: 'Mobile Org',
      fullName: 'Mobile Organization Full Name',
      inn: '5400000000',
      raionId: 301,
      raion: 'Central',
      orgTypeId: 401,
      orgType: 'Client',
      visible: true,
      isManager: false,
      emails: ['org@example.test'],
      emailCount: 1,
      contactCount: 2,
      openWorkItems: 3
    }
  ],
  totalCount: 1
};

const organizationRaionsResponse = [
  {
    id: 301,
    name: 'Central',
    count: 1
  }
];

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
      transportProfileName: mainTransportProfile.name,
      createdAtUtc: '2026-06-10T12:00:00Z',
      updatedAtUtc: '2026-06-10T12:00:00Z'
    }
  ],
  totalCount: 1
};

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

const pages = [
  { path: '/', heading: 'Дашборд', content: 'Новая рассылка', kind: 'page' },
  { path: '/employees', heading: 'Сотрудники', content: 'Demo Employee', kind: 'table' },
  { path: '/organizations', heading: 'Организации', content: 'Mobile Org', kind: 'table' },
  { path: '/campaigns', heading: 'Рассылки', content: 'Monthly Digest', kind: 'table' },
  { path: '/dispatch', heading: 'Очередь рассылок', content: 'recipient@example.test', kind: 'table' },
  { path: '/settings', heading: 'Настройки', content: mainTransportProfile.name, kind: 'table' }
];

async function expectWorkspaceContentVisible(
  page: Parameters<typeof expectNoDocumentHorizontalOverflow>[0],
  content: string,
  kind: string,
  viewportWidth: number
) {
  if (kind !== 'table') {
    await expect(page.getByText(content).first()).toBeVisible();
    return;
  }

  const selector = viewportWidth <= 720 ? '.data-table-card' : '.data-table';
  await expect(page.locator(selector).filter({ hasText: content }).first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await setupAuthenticatedSession(page);
  await mockTransportProfiles(page);

  await page.route(/\/api\/dashboard(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, dashboardResponse);
  });

  await page.route(/\/api\/employees(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, employeesResponse);
  });

  await page.route(/\/api\/organizations\/raions(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, organizationRaionsResponse);
  });

  await page.route(/\/api\/organizations(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, organizationsResponse);
  });

  await page.route(/\/api\/campaigns(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, campaignsResponse);
  });

  await page.route(/\/api\/dispatch\/items(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, dispatchItemsResponse);
  });

  await page.route(/\/api\/dispatch\/batches(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, dispatchBatchesResponse);
  });
});

for (const viewport of viewports) {
  for (const pageCase of pages) {
    test(`${pageCase.heading} fits ${viewport.name} viewport`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(pageCase.path);

      await expect(page.locator('.app-shell')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('heading', { name: pageCase.heading }).first()).toBeVisible({ timeout: 15_000 });
      await expectWorkspaceContentVisible(page, pageCase.content, pageCase.kind, viewport.width);
      await expect.poll(() => expectNoDocumentHorizontalOverflow(page)).toBe(true);
    });
  }
}
