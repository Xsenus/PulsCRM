import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const demoUsers = [
  {
    id: 1,
    login: 'demo',
    fullName: 'Demo User',
    userGroup: 'Administrators'
  }
];

async function mockLoginUsers(page: Page) {
  await page.route('**/api/auth/users**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(demoUsers)
    });
  });
}

test('login page renders the manual login form', async ({ page }) => {
  await mockLoginUsers(page);

  await page.goto('/login');

  await expect(page.locator('.login-card')).toBeVisible();
  await expect(page.locator('#login-value')).toBeVisible();
  await expect(page.locator('#password-value')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});

test('protected route redirects unauthenticated user to login', async ({ page }) => {
  await mockLoginUsers(page);

  await page.goto('/employees');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('#login-value')).toBeVisible();
});

test('login error is shown when API rejects credentials', async ({ page }) => {
  await mockLoginUsers(page);
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Bad credentials' })
    });
  });

  await page.goto('/login');
  await page.locator('#login-value').fill('demo');
  await page.locator('#password-value').fill('wrong-password');
  await page.locator('button[type="submit"]').click();

  await expect(page.locator('.login-alert')).toContainText('Bad credentials');
});
