import { expect, test, type Page } from '@playwright/test';
import { z } from 'zod';
import {
  menuItemSchema,
  orderSchema,
  qrSchema,
  tableSchema,
  authSchema,
} from '../../src/shared/api/contracts';
test.skip(
  process.env.REAL_E2E !== '1',
  'Run only against an explicitly chosen isolated dev/test backend.',
);
const backend = process.env.TEST_API_URL || 'http://localhost:8080';
async function login(page: Page) {
  await page.goto('/staff/login');
  await page.getByLabel('Логин').fill(process.env.TEST_ADMIN_USERNAME!);
  await page
    .getByLabel('Пароль', { exact: true })
    .fill(process.env.TEST_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'Войти в систему' }).click();
  await expect(
    page.getByRole('heading', { name: /Всё начинается/ }),
  ).toBeVisible();
}
test('real QR, lost response replay, KDS, stop-list, security and responsive screens', async ({
  browser,
  request,
}) => {
  const result = await request.post(`${backend}/api/staff/auth/login`, {
    data: {
      username: process.env.TEST_ADMIN_USERNAME,
      password: process.env.TEST_ADMIN_PASSWORD,
    },
  });
  expect(result.ok()).toBe(true);
  const session = authSchema.parse(await result.json()),
    headers = { Authorization: `Bearer ${session.accessToken}` };
  const tables = tableSchema
    .array()
    .parse(
      await (
        await request.get(`${backend}/api/staff/tables`, { headers })
      ).json(),
    );
  const table = tables.find((t) => t.isActive)!;
  expect(!!table).toBe(true);
  const qr = qrSchema.parse(
    await (
      await request.get(`${backend}/api/staff/tables/${table.id}/qr`, {
        headers,
      })
    ).json(),
  );
  const menu = menuItemSchema
    .array()
    .parse(
      await (
        await request.get(`${backend}/api/menu?includeUnavailable=true`)
      ).json(),
    );
  const available = menu.filter((m) => m.isActive && m.isAvailable);
  expect(available.length >= 2).toBe(true);
  const staffContext = await browser.newContext(),
    guestContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
  const staff = await staffContext.newPage(),
    guest = await guestContext.newPage();
  const errors: string[] = [];
  staff.on('pageerror', (e) => errors.push(e.name));
  guest.on('pageerror', (e) => errors.push(e.name));
  const wsStates: boolean[] = [];
  staff.on('websocket', (socket) => {
    if (new URL(socket.url()).pathname !== '/ws') return;
    const index = wsStates.length;
    wsStates.push(false);
    socket.on('close', () => {
      wsStates[index] = true;
    });
  });
  await login(staff);
  await staff
    .getByRole('link', { name: 'Открыть кухню', exact: true })
    .first()
    .click();
  await expect(
    staff.getByRole('heading', { name: /Кухня в работе/ }),
  ).toBeVisible();
  await expect(staff.getByText('Онлайн', { exact: true })).toBeVisible();
  await guest.goto('/menu' + new URL(qr.url).search);
  await expect(guest.getByRole('heading', { name: /Наше меню/ })).toBeVisible();
  expect(new URL(guest.url()).searchParams.has('token')).toBe(false);
  const attempts: { key: string | undefined; body: string | null }[] = [];
  let confirmedOrder: z.infer<typeof orderSchema> | null = null,
    sentAt = 0;
  await guest.route('**/api/orders', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    attempts.push({
      key: route.request().headers()['idempotency-key'],
      body: route.request().postData(),
    });
    if (attempts.length === 1) {
      sentAt = Date.now();
      const response = await route.fetch();
      confirmedOrder = orderSchema.parse(await response.json());
      await route.abort('connectionreset');
    } else await route.continue();
  });
  for (const item of available.slice(0, 2))
    await guest
      .getByRole('button', { name: `Добавить ${item.name}`, exact: true })
      .click();
  await guest.getByRole('link', { name: 'Корзина, 2 блюд' }).click();
  await guest
    .getByRole('button', { name: 'Подтвердить заказ', exact: true })
    .click();
  await expect(
    guest.getByRole('button', { name: 'Повторить проверку результата' }),
  ).toBeVisible();
  expect(confirmedOrder !== null).toBe(true);
  const created = confirmedOrder as unknown as z.infer<typeof orderSchema>;
  await expect(
    staff.locator('.order-card').filter({ hasText: `ЗАКАЗ #${created.id}` }),
  ).toBeVisible();
  const kdsObservedMs = Date.now() - sentAt;
  await guest.reload();
  await guest
    .getByRole('button', { name: 'Повторить проверку результата' })
    .click();
  await expect(
    guest.getByText('Ваш заказ отправлен в ресторан.'),
  ).toBeVisible();
  expect(attempts.length).toBe(2);
  expect(
    attempts[0].key === attempts[1].key &&
      attempts[0].body === attempts[1].body,
  ).toBe(true);
  await guest.goto('/menu');
  await guest
    .getByRole('button', { name: `Добавить ${available[0].name}`, exact: true })
    .click();
  await staff.getByRole('link', { name: 'Стоп-лист', exact: true }).click();
  const toggle = staff.getByRole('switch', {
    name: `Наличие: ${available[0].name}`,
    exact: true,
  });
  try {
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await expect(
      guest.getByRole('button', {
        name: `Добавить одну порцию ${available[0].name}`,
        exact: true,
      }),
    ).toBeDisabled();
    await guest.getByRole('link', { name: 'Корзина, 1 блюд' }).click();
    await expect(
      guest.getByRole('button', { name: 'Подтвердить заказ', exact: true }),
    ).toBeDisabled();
    await request.patch(`${backend}/api/menu/${available[0].id}/availability`, {
      headers,
      data: { isAvailable: true },
    });
  } finally {
    await request.patch(`${backend}/api/menu/${available[0].id}/availability`, {
      headers,
      data: { isAvailable: true },
    });
  }
  await staff.getByRole('link', { name: 'Заказы', exact: true }).click();
  let card = staff
    .locator('.order-card')
    .filter({ hasText: `ЗАКАЗ #${created.id}` });
  await card.getByRole('button', { name: 'Начать готовить' }).click();
  await expect(
    staff
      .locator('.cooking .order-card')
      .filter({ hasText: `ЗАКАЗ #${created.id}` }),
  ).toBeVisible();
  card = staff
    .locator('.cooking .order-card')
    .filter({ hasText: `ЗАКАЗ #${created.id}` });
  await card.getByRole('button', { name: 'Завершить заказ' }).click();
  await expect(
    staff.locator('.order-card').filter({ hasText: `ЗАКАЗ #${created.id}` }),
  ).toHaveCount(0);
  const saved = orderSchema.parse(
    await (
      await request.get(`${backend}/api/orders/${created.id}`, { headers })
    ).json(),
  );
  expect(saved.status).toBe('COMPLETED');
  expect((await request.get(`${backend}/api/orders/active`)).status()).toBe(
    401,
  );
  for (const width of [320, 375, 390, 768, 1024, 1440, 1920]) {
    await guest.setViewportSize({ width, height: 900 });
    await guest.goto('/menu');
    await expect(
      guest.getByRole('heading', { name: /Наше меню/ }),
    ).toBeVisible();
    expect(
      await guest.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 390 || width === 1440)
      await guest.screenshot({
        path: `.local/real-menu-${width}.png`,
        fullPage: true,
      });
  }
  for (const width of [320, 375, 390, 768, 1024, 1440, 1920]) {
    await staff.setViewportSize({ width, height: 900 });
    expect(
      await staff.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await staff.setViewportSize({ width: 1440, height: 900 });
  await staff.screenshot({ path: '.local/real-kitchen.png', fullPage: true });
  await staff.getByRole('link', { name: 'Управление', exact: true }).click();
  await expect(
    staff.getByRole('heading', { name: /Всё начинается/ }),
  ).toBeVisible();
  for (const width of [320, 375, 390, 768, 1024, 1440, 1920]) {
    await staff.setViewportSize({ width, height: 900 });
    expect(
      await staff.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await staff.setViewportSize({ width: 1440, height: 900 });
  await staff.screenshot({ path: '.local/real-admin.png', fullPage: true });
  await staff.getByRole('link', { name: 'Столики и QR', exact: true }).click();
  await staff
    .locator('.table-card')
    .first()
    .getByRole('button', { name: 'QR-код', exact: true })
    .click();
  await expect(staff.getByAltText(/QR-код столика/)).toBeVisible();
  await staff.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await staff.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(
    staff.getByRole('heading', { name: 'С возвращением' }),
  ).toBeVisible();
  await expect.poll(() => wsStates.every(Boolean)).toBe(true);
  expect(errors).toEqual([]);
  // Contains no credentials, QR URLs or request bodies.
  const fs = await import('node:fs/promises');
  await fs.writeFile(
    '.local/real-e2e-result.json',
    JSON.stringify(
      {
        orderId: created.id,
        status: saved.status,
        totalAmount: saved.totalAmount,
        replaySameRequest: true,
        kdsObservedMs,
        responsiveWidths: [320, 375, 390, 768, 1024, 1440, 1920],
        pageErrors: errors.length,
      },
      null,
      2,
    ),
  );
  await staffContext.close();
  await guestContext.close();
});

test('real admin CRUD, table QR lifecycle and kitchen security', async ({
  page,
  request,
  browser,
}) => {
  const loginResponse = await request.post(`${backend}/api/staff/auth/login`, {
    data: {
      username: process.env.TEST_ADMIN_USERNAME,
      password: process.env.TEST_ADMIN_PASSWORD,
    },
  });
  expect(loginResponse.ok()).toBe(true);
  const session = authSchema.parse(await loginResponse.json());
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const suffix = Date.now().toString(36),
    categoryName = `E2E категория ${suffix}`,
    dishName = `E2E блюдо ${suffix}`;
  await login(page);
  await page.getByRole('link', { name: 'Категории', exact: true }).click();
  await page
    .getByRole('button', { name: 'Добавить категорию', exact: true })
    .click();
  await page.getByLabel('Название', { exact: true }).fill(categoryName);
  await page.getByLabel('Порядок сортировки').fill('99');
  await page.getByRole('button', { name: 'Сохранить категорию' }).click();
  const categoryRow = page.getByRole('row').filter({ hasText: categoryName });
  await expect(categoryRow).toBeVisible();
  await categoryRow
    .getByRole('button', { name: `Редактировать ${categoryName}`, exact: true })
    .click();
  await page.getByLabel('Порядок сортировки').fill('100');
  await page.getByRole('button', { name: 'Сохранить категорию' }).click();
  await expect(categoryRow.getByText('100', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Меню и блюда', exact: true }).click();
  await page
    .getByRole('button', { name: 'Добавить блюдо', exact: true })
    .click();
  await page.getByLabel('Название', { exact: true }).fill(dishName);
  await page.getByLabel('Цена, сом').fill('12.35');
  await page
    .getByLabel('Категория', { exact: true })
    .selectOption({ label: categoryName });
  await page
    .getByRole('button', { name: 'Сохранить блюдо', exact: true })
    .click();
  const dishRow = page.getByRole('row').filter({ hasText: dishName });
  await expect(dishRow).toBeVisible();
  await dishRow
    .getByRole('button', { name: `Редактировать ${dishName}`, exact: true })
    .click();
  await page.getByLabel('Цена, сом').fill('13.55');
  await page
    .getByRole('button', { name: 'Сохранить блюдо', exact: true })
    .click();
  await expect(dishRow.getByText(/13,55/)).toBeVisible();
  await dishRow
    .getByRole('button', { name: `Деактивировать ${dishName}`, exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Деактивировать', exact: true })
    .click();
  await expect(dishRow.getByText('Неактивно', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Категории', exact: true }).click();
  await page
    .getByRole('row')
    .filter({ hasText: categoryName })
    .getByRole('button', { name: `Удалить ${categoryName}`, exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Удалить категорию', exact: true })
    .click();
  await expect(page.getByText(/Категория связана с блюдами/)).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  // A separate unused category exercises successful hard delete.
  const unusedName = `E2E пустая ${suffix}`;
  await page
    .getByRole('button', { name: 'Добавить категорию', exact: true })
    .click();
  await page.getByLabel('Название', { exact: true }).fill(unusedName);
  await page
    .getByRole('button', { name: 'Сохранить категорию', exact: true })
    .click();
  await page
    .getByRole('row')
    .filter({ hasText: unusedName })
    .getByRole('button', { name: `Удалить ${unusedName}`, exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Удалить категорию', exact: true })
    .click();
  await expect(
    page.getByRole('row').filter({ hasText: unusedName }),
  ).toHaveCount(0);

  const existingTables = tableSchema
    .array()
    .parse(
      await (
        await request.get(`${backend}/api/staff/tables`, { headers })
      ).json(),
    );
  let number = 9900;
  while (existingTables.some((t) => t.number === number)) number--;
  await page.getByRole('link', { name: 'Столики и QR', exact: true }).click();
  await page
    .getByRole('button', { name: 'Добавить столик', exact: true })
    .click();
  await page.getByLabel('Номер столика').fill(String(number));
  await page
    .getByRole('button', { name: 'Создать столик', exact: true })
    .click();
  const tableCard = page
    .locator('.table-card')
    .filter({ hasText: String(number) });
  await expect(tableCard).toBeVisible();
  const createdTable = tableSchema
    .array()
    .parse(
      await (
        await request.get(`${backend}/api/staff/tables`, { headers })
      ).json(),
    )
    .find((t) => t.number === number)!;
  const oldQr = qrSchema.parse(
    await (
      await request.get(`${backend}/api/staff/tables/${createdTable.id}/qr`, {
        headers,
      })
    ).json(),
  );
  await tableCard.getByRole('button', { name: 'QR-код', exact: true }).click();
  await expect(page.getByAltText(/QR-код столика/)).toBeVisible();
  await page
    .getByRole('button', { name: 'Перевыпустить QR', exact: true })
    .click();
  await page
    .getByRole('button', {
      name: 'Перевыпустить и отозвать старый QR',
      exact: true,
    })
    .click();
  await expect(page.getByText('Версия QR: 2.', { exact: false })).toBeVisible();
  const revoked = await request.get(`${backend}/api/tables/resolve`, {
    params: { tableNumber: number, tableToken: oldQr.tableToken },
  });
  expect(revoked.status()).toBe(403);
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await tableCard
    .getByRole('switch', { name: `Активность столика ${number}` })
    .click();
  await expect(tableCard.getByRole('switch')).not.toBeChecked();

  const username = `e2e-kitchen-${suffix}`,
    password = crypto.randomUUID();
  await page.getByRole('link', { name: 'Команда', exact: true }).click();
  await page.getByLabel('Логин', { exact: true }).fill(username);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Создать сотрудника', exact: true })
    .click();
  await expect(
    page.getByText(`Сотрудник ${username} создан. Роль: KITCHEN.`, {
      exact: true,
    }),
  ).toBeVisible();
  const kitchenLogin = await request.post(`${backend}/api/staff/auth/login`, {
    data: { username, password },
  });
  expect(kitchenLogin.ok()).toBe(true);
  const kitchenSession = authSchema.parse(await kitchenLogin.json());
  expect(
    (
      await request.get(`${backend}/api/staff/tables`, {
        headers: { Authorization: `Bearer ${kitchenSession.accessToken}` },
      })
    ).status(),
  ).toBe(403);
  const kitchenContext = await browser.newContext(),
    kitchen = await kitchenContext.newPage();
  await kitchen.goto('/staff/login');
  await kitchen.getByLabel('Логин').fill(username);
  await kitchen.getByLabel('Пароль', { exact: true }).fill(password);
  await kitchen.getByRole('button', { name: 'Войти в систему' }).click();
  await expect(
    kitchen.getByRole('heading', { name: /Кухня в работе/ }),
  ).toBeVisible();
  await kitchen.evaluate(() => {
    history.pushState({}, '', '/admin');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(
    kitchen.getByRole('heading', { name: 'Доступ ограничен' }),
  ).toBeVisible();
  await kitchenContext.close();
  const fs = await import('node:fs/promises');
  await fs.writeFile(
    '.local/admin-e2e-result.json',
    JSON.stringify(
      {
        menuCrud: true,
        categoryCrud: true,
        categoryInUse: true,
        tableNumber: number,
        tableInactive: true,
        oldQrRevoked: true,
        staffCreated: username,
        kitchenAdminForbidden: true,
      },
      null,
      2,
    ),
  );
});
