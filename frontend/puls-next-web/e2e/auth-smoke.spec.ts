import { expect, test } from '@playwright/test';
import { fulfillJson, mockLoginUsers } from './helpers';

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
    await fulfillJson(route, { message: 'Bad credentials' }, 401);
  });

  await page.goto('/login');
  await page.locator('#login-value').fill('demo');
  await page.locator('#password-value').fill('wrong-password');
  await page.locator('button[type="submit"]').click();

  await expect(page.locator('.login-alert')).toContainText('Bad credentials');
});

test('login network error is shown as a user-facing API availability message', async ({ page }) => {
  await mockLoginUsers(page);
  await page.route('**/api/auth/login', async (route) => {
    await route.abort('failed');
  });

  await page.goto('/login');
  await page.locator('#login-value').fill('demo');
  await page.locator('#password-value').fill('correct-password');
  await page.locator('button[type="submit"]').click();

  const alert = page.locator('.login-alert');
  await expect(alert).toContainText('API недоступен');
  await expect(alert).not.toContainText('Network Error');
});
