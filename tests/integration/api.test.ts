import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { api } from '../../src/shared/api/client';
import { validateQr } from '../../src/features/qr-session/session';
import { getAttempt, saveAttempt } from '../../src/features/checkout/attempt';
import { useAuth } from '../../src/features/auth/store';
import { loadActiveOrders } from '../../src/features/orders/snapshot';
import { auth, item, order } from '../fixtures';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  useAuth.getState().logout();
});
afterAll(() => server.close());
describe('real HTTP transport with controlled test-only MSW', () => {
  it('loads menu/categories and rejects inactive guests on server validation', async () => {
    server.use(
      http.get('*/api/menu', ({ request }) => {
        expect(
          new URL(request.url).searchParams.get('includeUnavailable'),
        ).toBe('true');
        expect(request.headers.has('Authorization')).toBe(false);
        return HttpResponse.json([item]);
      }),
      http.get('*/api/categories', () =>
        HttpResponse.json([
          { id: 2, name: 'Второе', sortOrder: 5 },
          { id: 1, name: 'Первое', sortOrder: 0 },
        ]),
      ),
      http.get('*/api/tables/resolve', ({ request }) => {
        const url = new URL(request.url);
        return url.searchParams.get('tableToken') === 'valid-test'
          ? HttpResponse.json({
              id: 3,
              number: 3,
              isActive: true,
              qrTokenVersion: 1,
            })
          : HttpResponse.json(
              {
                status: 403,
                code: 'INVALID_TABLE_TOKEN',
                detail: 'Invalid token',
              },
              { status: 403 },
            );
      }),
    );
    expect(await api.menu()).toHaveLength(1);
    expect((await api.categories())[0].id).toBe(1);
    await expect(
      validateQr({ tableNumber: 3, tableToken: 'valid-test' }),
    ).resolves.toEqual({ tableNumber: 3, tableToken: 'valid-test' });
    await expect(
      validateQr({ tableNumber: 3, tableToken: 'invalid' }),
    ).rejects.toMatchObject({ problem: { code: 'INVALID_TABLE_TOKEN' } });
  });
  it('replays the same immutable POST after a lost response', async () => {
    const calls: { key: string | null; body: unknown }[] = [];
    server.use(
      http.post('*/api/orders', async ({ request }) => {
        calls.push({
          key: request.headers.get('Idempotency-Key'),
          body: await request.json(),
        });
        return calls.length === 1
          ? HttpResponse.error()
          : HttpResponse.json(order, { status: 200 });
      }),
    );
    const attempt = saveAttempt({
      tableNumber: 3,
      tableToken: 'valid-test',
      items: [{ menuItemId: 1, quantity: 2 }],
    });
    await expect(
      api.createOrder(attempt.body, attempt.key),
    ).rejects.toMatchObject({ problem: { code: 'NETWORK_ERROR' } });
    const restored = getAttempt()!;
    expect(await api.createOrder(restored.body, restored.key)).toEqual(order);
    expect(calls[0]).toEqual(calls[1]);
  });
  it('returns explicit stop-list conflicts', async () => {
    server.use(
      http.post('*/api/orders', () =>
        HttpResponse.json(
          { status: 409, code: 'MENU_ITEM_UNAVAILABLE', detail: 'Unavailable' },
          { status: 409 },
        ),
      ),
    );
    await expect(
      api.createOrder(
        {
          tableNumber: 3,
          tableToken: 'valid-test',
          items: [{ menuItemId: 1, quantity: 1 }],
        },
        crypto.randomUUID(),
      ),
    ).rejects.toMatchObject({ problem: { code: 'MENU_ITEM_UNAVAILABLE' } });
  });
  it('validates login and /me and removes expired/unauthorized staff state', async () => {
    server.use(
      http.post('*/api/staff/auth/login', () => HttpResponse.json(auth)),
      http.get('*/api/staff/auth/me', ({ request }) => {
        expect(request.headers.get('Authorization')).toBe(
          'Bearer test-only-token',
        );
        return HttpResponse.json(auth.staff);
      }),
    );
    useAuth
      .getState()
      .setSession(
        await api.login({ username: 'test', password: 'test-password' }),
      );
    expect(await api.me()).toEqual(auth.staff);
    server.use(
      http.get('*/api/staff/auth/me', () =>
        HttpResponse.json(
          { code: 'UNAUTHORIZED', detail: 'Expired' },
          { status: 401 },
        ),
      ),
    );
    await expect(api.me()).rejects.toBeTruthy();
    expect(useAuth.getState().session).toBeNull();
  });
  it('sets cooking, completes without body and explicitly sets availability', async () => {
    useAuth.getState().setSession(auth);
    server.use(
      http.patch('*/api/orders/42/status', async ({ request }) => {
        expect(await request.json()).toEqual({ status: 'COOKING' });
        return HttpResponse.json({ ...order, status: 'COOKING' });
      }),
      http.patch('*/api/orders/42/complete', async ({ request }) => {
        expect(await request.text()).toBe('');
        return HttpResponse.json({ ...order, status: 'COMPLETED' });
      }),
      http.patch('*/api/menu/1/availability', async ({ request }) => {
        expect(await request.json()).toEqual({ isAvailable: false });
        return HttpResponse.json({ ...item, isAvailable: false });
      }),
    );
    expect((await api.cooking(42)).status).toBe('COOKING');
    expect((await api.complete(42)).status).toBe('COMPLETED');
    expect((await api.availability(1, false)).isAvailable).toBe(false);
  });
  it('retrieves active arrays across multiple pages', async () => {
    useAuth.getState().setSession(auth);
    server.use(
      http.get('*/api/orders/active', ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'));
        return HttpResponse.json(page < 2 ? [{ ...order, id: 42 + page }] : []);
      }),
    );
    expect(await loadActiveOrders()).toHaveLength(2);
  });
});
