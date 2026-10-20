import { expect, test, type Page } from '@playwright/test';
import { item, tea, order, auth } from '../fixtures';
async function controlledApi(page: Page, loseFirst = false) {
  const attempts: { key: string | undefined; body: unknown }[] = [];
  await page.routeWebSocket('**/ws', (socket) => {
    socket.onMessage((message) => {
      const frame = String(message);
      if (frame.startsWith('CONNECT'))
        socket.send('CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0');
      if (frame.startsWith('SUBSCRIBE')) {
        const receipt = frame.match(/receipt:([^\n]+)/)?.[1];
        if (receipt) socket.send(`RECEIPT\nreceipt-id:${receipt}\n\n\0`);
      }
    });
  });
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const url = new URL(route.request().url()),
        path = url.pathname;
      let data: unknown;
      if (path === '/api/menu' || path === '/api/staff/menu')
        data = [item, tea];
      else if (path === '/api/categories')
        data = [
          { id: 1, name: 'Горячие блюда', sortOrder: 0 },
          { id: 2, name: 'Напитки', sortOrder: 1 },
          { id: 3, name: 'Десерты', sortOrder: 2 },
          { id: 4, name: 'Салаты и закуски', sortOrder: 3 },
        ];
      else if (path === '/api/tables/resolve') {
        if (url.searchParams.get('tableToken') === 'bad') {
          await route.fulfill({
            status: 403,
            json: {
              status: 403,
              code: 'INVALID_TABLE_TOKEN',
              detail: 'Invalid',
            },
          });
          return;
        }
        data = { id: 3, number: 3, isActive: true, qrTokenVersion: 1 };
      } else if (
        path === '/api/orders' &&
        route.request().method() === 'POST'
      ) {
        attempts.push({
          key: route.request().headers()['idempotency-key'],
          body: route.request().postDataJSON(),
        });
        if (loseFirst && attempts.length === 1) {
          await route.abort('connectionreset');
          return;
        }
        data = order;
      } else if (path === '/api/staff/auth/login')
        data = { ...auth, staff: { ...auth.staff, role: 'KITCHEN' } };
      else if (path === '/api/staff/auth/me')
        data = { ...auth.staff, role: 'KITCHEN' };
      else if (path === '/api/orders/active') data = [];
      else {
        await route.fulfill({
          status: 404,
          json: { code: 'NOT_FOUND', detail: 'Test route missing' },
        });
        return;
      }
      await route.fulfill({
        status: path === '/api/orders' && attempts.length === 1 ? 201 : 200,
        json: data,
      });
    },
  );
  return attempts;
}
test('guest QR → cart → server-confirmed result', async ({ page }) => {
  await controlledApi(page);
  await page.goto('/menu?table=3&token=test-only');
  await expect(page.getByRole('heading', { name: /Наше меню/ })).toBeVisible();
  expect(new URL(page.url()).searchParams.has('token')).toBe(false);
  await page
    .getByRole('button', { name: 'Добавить Лагман', exact: true })
    .click();
  await page.getByRole('button', { name: 'Добавить Чай', exact: true }).click();
  await page.getByRole('link', { name: 'Корзина, 2 блюд' }).click();
  await page
    .getByRole('button', { name: 'Подтвердить заказ', exact: true })
    .click();
  await expect(page.getByText('Ваш заказ отправлен в ресторан.')).toBeVisible();
  await expect(page.getByText('#42')).toBeVisible();
});
test('lost HTTP response survives reload and replays original key/body', async ({
  page,
}) => {
  const attempts = await controlledApi(page, true);
  await page.goto('/menu?table=3&token=test-only');
  await page
    .getByRole('button', { name: 'Добавить Лагман', exact: true })
    .click();
  await page.getByRole('link', { name: 'Корзина, 1 блюд' }).click();
  await page
    .getByRole('button', { name: 'Подтвердить заказ', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Повторить проверку результата' }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole('button', { name: 'Повторить проверку результата' })
    .click();
  await expect(page.getByText('Ваш заказ отправлен в ресторан.')).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[0]).toEqual(attempts[1]);
});
test('rejects bad QR, protects admin routes and restricts kitchen role', async ({
  page,
}) => {
  await controlledApi(page);
  await page.goto('/menu?table=3&token=bad');
  await expect(
    page.getByText('QR-код устарел. Отсканируйте актуальный код на столике.'),
  ).toBeVisible();
  await page.goto('/admin/menu');
  await expect(
    page.getByRole('heading', { name: 'С возвращением' }),
  ).toBeVisible();
  await page.getByLabel('Логин').fill('test-kitchen');
  await page.getByLabel('Пароль', { exact: true }).fill('test-only-password');
  await page.getByRole('button', { name: 'Войти в систему' }).click();
  await expect(
    page.getByRole('heading', { name: /Кухня в работе/ }),
  ).toBeVisible();
  // SPA navigation preserves the in-memory role.
  await page.evaluate(() => {
    history.pushState({}, '', '/admin');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(
    page.getByRole('heading', { name: 'Доступ ограничен' }),
  ).toBeVisible();
});
for (const width of [320, 375, 390, 768, 1024, 1440, 1920])
  test(`guest layout without overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await controlledApi(page);
    await page.goto('/menu?table=3&token=test-only');
    await expect(
      page.getByRole('heading', { name: /Наше меню/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole('button', { name: 'Добавить Лагман', exact: true })
      .click();
    await expect(page.getByRole('link', { name: /Ваш заказ/ })).toBeVisible();
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: `.local/guest-${width}.png`,
        fullPage: true,
      });
  });

test('HTTP LAN fallback creates valid idempotency keys without crypto.randomUUID', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(crypto, 'randomUUID', {
      value: undefined,
      configurable: true,
    });
  });
  const attempts = await controlledApi(page);
  await page.goto('/menu?table=3&token=test-only');
  await page
    .getByRole('button', { name: 'Добавить Лагман', exact: true })
    .click();
  await page.getByRole('link', { name: 'Корзина, 1 блюд' }).click();
  await page
    .getByRole('button', { name: 'Подтвердить заказ', exact: true })
    .click();
  await expect(page.getByText('Ваш заказ отправлен в ресторан.')).toBeVisible();
  expect(attempts[0].key).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});
