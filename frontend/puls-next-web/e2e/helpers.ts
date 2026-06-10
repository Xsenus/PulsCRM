import type { Page, Route } from '@playwright/test';

export const currentUser = {
  id: 1,
  login: 'demo',
  fullName: 'Demo User',
  isRoot: true,
  userGroup: 'Administrators',
  email: 'demo@example.test',
  phone: '+7 000 000-00-00'
};

export async function fulfillJson(route: Route, value: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(value)
  });
}

export async function mockLoginUsers(page: Page) {
  await page.route(/\/api\/auth\/users(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, [
      {
        id: currentUser.id,
        login: currentUser.login,
        fullName: currentUser.fullName,
        userGroup: currentUser.userGroup
      }
    ]);
  });
}

export async function setupAuthenticatedSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('puls-next-token', 'playwright-token');
  });

  await page.route(/\/api\/auth\/me(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, currentUser);
  });
}

export function expectNoDocumentHorizontalOverflow(page: Page) {
  return page.evaluate(() => (
    document.documentElement.scrollWidth <= window.innerWidth + 1
  ));
}
