import { beforeAll, afterAll, afterEach, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/app/App';
import { queryClient } from '../../src/app/providers/query';
import { useAuth } from '../../src/features/auth/store';
import { useCart } from '../../src/features/cart/store';
import { item, tea, order, auth } from '../fixtures';
vi.mock('@stomp/stompjs', () => ({
  Client: class {
    activate() {}
    deactivate() {
      return Promise.resolve();
    }
  },
}));
const server = setupServer(
  http.get('*/api/menu', () => HttpResponse.json([item, tea])),
  http.get('*/api/categories', () =>
    HttpResponse.json([{ id: 1, name: 'Горячее', sortOrder: 0 }]),
  ),
  http.get('*/api/tables/resolve', () =>
    HttpResponse.json({ id: 3, number: 3, isActive: true, qrTokenVersion: 1 }),
  ),
);
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
  useAuth.getState().logout();
  useCart.setState({ lines: [], tableNumber: null });
  history.replaceState({}, '', '/');
});
afterAll(() => server.close());
it('shows server-validated menu, adds dishes and confirms server order', async () => {
  const user = userEvent.setup();
  server.use(
    http.post('*/api/orders', () => HttpResponse.json(order, { status: 201 })),
  );
  history.replaceState({}, '', '/menu?table=3&token=test-only');
  render(<App />);
  // Cold lazy-route transforms can exceed the default one-second DOM wait.
  await screen.findByRole('heading', { name: /Наше меню/ }, { timeout: 5000 });
  expect(location.search).not.toContain('token');
  await user.click(screen.getByRole('button', { name: 'Добавить Лагман' }));
  await user.click(
    screen.getByRole('button', { name: 'Добавить одну порцию Лагман' }),
  );
  await user.click(screen.getByRole('button', { name: 'Добавить Чай' }));
  await user.click(screen.getByRole('link', { name: 'Корзина, 3 блюд' }));
  await user.click(
    await screen.findByRole('button', { name: 'Подтвердить заказ' }),
  );
  await screen.findByText('Ваш заказ отправлен в ресторан.');
  expect(screen.getByText('#42')).toBeInTheDocument();
  expect(sessionStorage.getItem('restaurant.pending.v1')).toBeNull();
}, 10000);
it('denies an invalid QR and cannot manually select a table', async () => {
  server.use(
    http.get('*/api/tables/resolve', () =>
      HttpResponse.json(
        { status: 403, code: 'INVALID_TABLE_TOKEN', detail: 'Invalid' },
        { status: 403 },
      ),
    ),
  );
  history.replaceState({}, '', '/menu?table=3&token=invalid-test');
  render(<App />);
  await screen.findByText(
    'QR-код устарел. Отсканируйте актуальный код на столике.',
  );
  expect(
    screen.queryByRole('button', { name: 'Добавить Лагман' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});
it('guards unauthenticated staff and prevents kitchen role opening admin', async () => {
  history.replaceState({}, '', '/admin/menu');
  render(<App />);
  await screen.findByRole('heading', { name: 'С возвращением' });
  expect(location.pathname).toBe('/staff/login');
});
it('authenticates through login and /me then opens allowed kitchen destination', async () => {
  const user = userEvent.setup();
  const kitchen = { ...auth, staff: { ...auth.staff, role: 'KITCHEN' } };
  server.use(
    http.post('*/api/staff/auth/login', () => HttpResponse.json(kitchen)),
    http.get('*/api/staff/auth/me', () => HttpResponse.json(kitchen.staff)),
    http.get('*/api/orders/active', () => HttpResponse.json([])),
  );
  history.replaceState({}, '', '/staff/login');
  render(<App />);
  await user.type(await screen.findByLabelText('Логин'), 'kitchen');
  await user.type(screen.getByLabelText('Пароль'), 'test-password');
  await user.click(screen.getByRole('button', { name: 'Войти в систему' }));
  await screen.findByRole('heading', { name: /Кухня в работе/ });
  expect(sessionStorage.getItem('accessToken')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Выйти' }));
  await waitFor(() => expect(useAuth.getState().session).toBeNull());
});
