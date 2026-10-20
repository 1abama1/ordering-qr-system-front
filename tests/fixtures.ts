import type { MenuItem, Order, AuthSession } from '../src/shared/api/contracts';
export const item: MenuItem = {
  id: 1,
  name: 'Лагман',
  description: 'Домашняя лапша',
  price: 320,
  currency: 'KGS',
  imageUrl: null,
  categoryId: 1,
  isAvailable: true,
  isActive: true,
  updatedAt: '2026-10-20T10:00:00Z',
  version: 0,
};
export const tea: MenuItem = { ...item, id: 2, name: 'Чай', price: 80 };
export const order: Order = {
  id: 42,
  tableNumber: 3,
  status: 'PENDING',
  totalAmount: 720,
  currency: 'KGS',
  createdAt: '2026-10-20T10:00:00Z',
  updatedAt: '2026-10-20T10:00:00Z',
  completedAt: null,
  version: 0,
  items: [
    {
      menuItemId: 1,
      menuItemName: 'Лагман',
      quantity: 2,
      priceAtOrder: 320,
      lineTotal: 640,
    },
    {
      menuItemId: 2,
      menuItemName: 'Чай',
      quantity: 1,
      priceAtOrder: 80,
      lineTotal: 80,
    },
  ],
};
export const auth: AuthSession = {
  accessToken: 'test-only-token',
  tokenType: 'Bearer',
  expiresAt: '2099-01-01T00:00:00Z',
  staff: { id: 1, username: 'test-admin', role: 'ADMIN' },
};
