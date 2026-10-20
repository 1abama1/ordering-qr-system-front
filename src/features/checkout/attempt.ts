import { secureUuid } from '../../shared/lib/uuid';
import { z } from '../../shared/config/validation';
import {
  createOrderSchema,
  type MenuItem,
  type CreateOrderRequest,
} from '../../shared/api/contracts';
import { readStorage, writeStorage } from '../../shared/lib/storage';
import type { QrSession } from '../qr-session/session';
import type { CartLine } from '../cart/store';
export const ATTEMPT_KEY = 'restaurant.pending.v1';
const attemptSchema = z.object({ key: z.uuid(), body: createOrderSchema });
export type PendingAttempt = z.infer<typeof attemptSchema>;
export function getAttempt() {
  const r = attemptSchema.safeParse(readStorage(ATTEMPT_KEY));
  return r.success ? r.data : null;
}
export function hasCorruptAttempt() {
  return sessionStorage.getItem(ATTEMPT_KEY) !== null && !getAttempt();
}
export function buildOrder(
  session: QrSession,
  lines: CartLine[],
  menu: MenuItem[],
): CreateOrderRequest {
  for (const line of lines) {
    const item = menu.find((m) => m.id === line.menuItemId);
    if (!item?.isActive || !item.isAvailable)
      throw new Error(
        'В корзине есть недоступные блюда. Удалите их и подтвердите обновлённый состав.',
      );
  }
  return createOrderSchema.parse({
    ...session,
    items: lines.map((l) => ({
      menuItemId: l.menuItemId,
      quantity: l.quantity,
    })),
  });
}
export function saveAttempt(body: CreateOrderRequest): PendingAttempt {
  const existing = getAttempt();
  if (existing) return existing;
  if (hasCorruptAttempt())
    throw new Error(
      'Не удалось восстановить предыдущую попытку. Обратитесь к сотруднику.',
    );
  const attempt = attemptSchema.parse({
    key: secureUuid(),
    body: structuredClone(body),
  });
  writeStorage(ATTEMPT_KEY, attempt);
  return attempt;
}
export const clearAttempt = () => sessionStorage.removeItem(ATTEMPT_KEY);
