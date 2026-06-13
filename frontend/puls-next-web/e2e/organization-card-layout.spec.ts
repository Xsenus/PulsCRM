import { expect, test } from '@playwright/test';
import {
  expectNoDocumentHorizontalOverflow,
  fulfillJson,
  setupAuthenticatedSession
} from './helpers';

const organizationDetails = {
  id: 201,
  name: 'Муниципальная организация с длинным названием',
  smallName: 'МО Длинное название',
  fullName: 'Муниципальная организация с длинным названием для проверки адаптивной карточки',
  inn: '5400000000',
  raionId: 301,
  raion: 'Центральный район',
  orgTypeId: 401,
  orgType: 'Учреждение',
  visible: true,
  isManager: false,
  emails: ['org@example.test', 'director@example.test'],
  emailCount: 2,
  contactCount: 1,
  openWorkItems: 1,
  ogrn: '1025400000000',
  kpp: '540001001',
  addressLegal: 'Новосибирск, Красный проспект, 1',
  addressActual: 'Новосибирск, Красный проспект, 1',
  phone: '+7 (383) 100-00-00',
  site: 'https://example.test',
  primaryEmail: 'org@example.test',
  directorEmail: 'director@example.test',
  directorFullName: 'Иванов Иван Иванович',
  directorPosition: 'Директор',
  directorPhone: '+7 (383) 200-00-00',
  comment: 'Рабочий комментарий организации',
  otherInfo: 'Дополнительная информация',
  debtAmount: 1200,
  debtActualAmount: 300,
  debtMinus6Amount: 0,
  salaryEnabled: true,
  oneCAccountingEnabled: true,
  oneCSalaryEnabled: false,
  oneCHousingEnabled: false,
  salaryDatabaseCount: 1,
  salaryOrganizationCount: 1,
  salaryExtraWorkplaces: 0,
  oneCBaseContract: false,
  oneCItsCompleted: false,
  siteOnSupport: false,
  siteLicenseCompleted: false,
  contacts: [],
  tasks: [{ id: 1, caption: 'Проверить карточку', state: 'В работе' }],
  oneCSnapshots: [],
  programInfos: [],
  events: [],
  contracts: [],
  attachments: [],
  realizations: [],
  parusLicenses: [],
  parusOrders: []
};

const organizationLookups = {
  raions: [{ id: 301, name: 'Центральный район' }],
  orgTypes: [{ id: 401, name: 'Учреждение' }]
};

const organizationsResponse = {
  items: [
    {
      id: organizationDetails.id,
      name: organizationDetails.name,
      smallName: organizationDetails.smallName,
      fullName: organizationDetails.fullName,
      inn: organizationDetails.inn,
      raionId: organizationDetails.raionId,
      raion: organizationDetails.raion,
      orgTypeId: organizationDetails.orgTypeId,
      orgType: organizationDetails.orgType,
      visible: organizationDetails.visible,
      isManager: organizationDetails.isManager,
      emails: organizationDetails.emails,
      emailCount: organizationDetails.emailCount,
      contactCount: organizationDetails.contactCount,
      openWorkItems: organizationDetails.openWorkItems
    }
  ],
  totalCount: 1
};

const organizationRaionsResponse = [
  {
    id: organizationDetails.raionId,
    name: organizationDetails.raion,
    count: 1
  }
];

test.beforeEach(async ({ page }) => {
  await setupAuthenticatedSession(page);

  await page.route(/\/api\/organizations\/raions(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, organizationRaionsResponse);
  });

  await page.route(/\/api\/organizations\/lookups(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, organizationLookups);
  });

  await page.route(/\/api\/organizations\/201(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, organizationDetails);
  });

  await page.route(/\/api\/organizations(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, organizationsResponse);
  });
});

test('organization card uses 70/30 desktop columns', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/organizations/201/edit');

  await expect(page.getByRole('heading', { name: organizationDetails.name })).toBeVisible();
  await expect(page.locator('.organization-record-layout')).toBeVisible();
  await expect(page.locator('.organization-record-content')).toBeVisible();
  await expect(page.locator('.organization-record-sidebar')).toBeVisible();

  const layout = await page.locator('.organization-record-layout').boundingBox();
  const content = await page.locator('.organization-record-content').boundingBox();
  const sidebar = await page.locator('.organization-record-sidebar').boundingBox();

  expect(layout).not.toBeNull();
  expect(content).not.toBeNull();
  expect(sidebar).not.toBeNull();

  const contentRatio = content!.width / layout!.width;
  const sidebarRatio = sidebar!.width / layout!.width;

  expect(contentRatio).toBeGreaterThan(0.64);
  expect(contentRatio).toBeLessThan(0.74);
  expect(sidebarRatio).toBeGreaterThan(0.24);
  expect(sidebarRatio).toBeLessThan(0.34);
  expect(sidebar!.x).toBeGreaterThan(content!.x + content!.width);
  await expect.poll(() => expectNoDocumentHorizontalOverflow(page)).toBe(true);
});

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 }
]) {
  test(`organization card keeps summary above tabs on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/organizations/201/edit');

    await expect(page.getByRole('heading', { name: organizationDetails.name })).toBeVisible();
    await expect(page.locator('.organization-record-sidebar')).toBeVisible();
    await expect(page.locator('.organization-card-tabs').first()).toBeVisible();

    const sidebar = await page.locator('.organization-record-sidebar').boundingBox();
    const tabs = await page.locator('.organization-card-tabs').first().boundingBox();

    expect(sidebar).not.toBeNull();
    expect(tabs).not.toBeNull();
    expect(sidebar!.y).toBeLessThan(tabs!.y);
    expect(sidebar!.width).toBeLessThanOrEqual(viewport.width);
    await expect.poll(() => expectNoDocumentHorizontalOverflow(page)).toBe(true);
  });
}

test('organization card confirms leaving with unsaved changes', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/organizations/201/edit');

  await expect(page.getByRole('heading', { name: organizationDetails.name })).toBeVisible();

  const nameInput = page.getByRole('textbox', { name: 'Название', exact: true });
  await nameInput.fill('Измененное название');
  await expect(page.getByText('Черновик изменен')).toBeVisible();

  await page.getByLabel('К списку организаций').click();
  await expect(page.getByRole('dialog', { name: 'Есть несохраненные изменения' })).toBeVisible();
  await expect(page.getByText('правки будут потеряны')).toBeVisible();

  await page.getByRole('button', { name: 'Остаться' }).click();
  await expect(page.getByRole('dialog', { name: 'Есть несохраненные изменения' })).toBeHidden();
  await expect(page).toHaveURL(/\/organizations\/201\/edit$/);
  await expect(nameInput).toHaveValue('Измененное название');

  await page.getByLabel('К списку организаций').click();
  await page.getByRole('button', { name: 'Выйти без сохранения' }).click();

  await expect(page).toHaveURL(/\/organizations$/);
  await expect(page.getByRole('heading', { name: 'Организации' })).toBeVisible();
});
