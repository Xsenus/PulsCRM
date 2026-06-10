import { expect, test } from '@playwright/test';
import { expectNoDocumentHorizontalOverflow, mockLoginUsers } from './helpers';

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1366, height: 768 }
];

test.beforeEach(async ({ page }) => {
  await mockLoginUsers(page);
});

for (const viewport of viewports) {
  test(`login page fits ${viewport.name} viewport`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/login');

    await expect(page.locator('.login-card')).toBeVisible();
    await expect(page.locator('#login-value')).toBeVisible();
    await expect(page.locator('#password-value')).toBeVisible();

    await expect.poll(() => expectNoDocumentHorizontalOverflow(page)).toBe(true);
  });
}
