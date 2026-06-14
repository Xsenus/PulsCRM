import { expect, test } from '@playwright/test';
import {
  expectNoDocumentHorizontalOverflow,
  fulfillJson,
  setupAuthenticatedSession
} from './helpers';

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

test.beforeEach(async ({ page }) => {
  await setupAuthenticatedSession(page);

  await page.route(/\/api\/employees(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, employeesResponse);
  });

  await page.route(/\/api\/organizations\/raions(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, organizationRaionsResponse);
  });

  await page.route(/\/api\/organizations(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, organizationsResponse);
  });
});

test('employees list opens for authenticated user', async ({ page }) => {
  await page.goto('/employees');

  await expect(page.locator('.app-shell')).toBeVisible();
  await expect(page.locator('.profile-button')).toHaveAttribute('title', 'Demo User');
  await expect(page.locator('.data-table')).toBeVisible();
  await expect(page.getByText('Demo Employee').first()).toBeVisible();
  await expect(page.getByText('employee@example.test').first()).toBeVisible();
});

test('organizations list uses mobile cards without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/organizations');

  await expect(page.locator('.app-shell')).toBeVisible();
  await expect(page.locator('.organizations-layout')).toBeVisible();
  await expect(page.locator('.data-table-card').filter({ hasText: 'Mobile Org' })).toBeVisible();
  const filterPanel = page.locator('#organizations-filter-panel');
  await expect(filterPanel).toBeHidden();
  const filterToggle = page.getByRole('button', { name: /^Фильтры/ });
  await expect(filterToggle).toBeVisible();
  await filterToggle.click();
  await expect(filterPanel).toBeVisible();
  await expect(filterPanel.getByText('Central').first()).toBeVisible();
  await filterPanel.getByRole('button', { name: 'Скрыть' }).click();
  await expect(filterPanel).toBeHidden();
  await expect.poll(() => expectNoDocumentHorizontalOverflow(page)).toBe(true);
});
