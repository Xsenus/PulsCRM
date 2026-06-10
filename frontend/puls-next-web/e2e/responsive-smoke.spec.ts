import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1366, height: 768 }
];

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/users**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 1,
          login: 'demo',
          fullName: 'Demo User',
          userGroup: 'Administrators'
        }
      ])
    });
  });
});

for (const viewport of viewports) {
  test(`login page fits ${viewport.name} viewport`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/login');

    await expect(page.locator('.login-card')).toBeVisible();
    await expect(page.locator('#login-value')).toBeVisible();
    await expect(page.locator('#password-value')).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(() => (
      document.documentElement.scrollWidth > window.innerWidth + 1
    ));

    expect(hasHorizontalOverflow).toBe(false);
  });
}
