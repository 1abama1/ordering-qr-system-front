import { api } from '../../shared/api/client';
import type { Order } from '../../shared/api/contracts';
export async function loadActiveOrders(
  signal?: AbortSignal,
  pageLoader = api.activePage,
): Promise<Order[]> {
  const orders = new Map<number, Order>();
  const pageFingerprints = new Set<string>();
  // Explicit bound, with an error instead of silently truncating the kitchen.
  for (let page = 0; page < 500; page++) {
    const batch = await pageLoader(page, signal);
    if (!batch.length)
      return [...orders.values()]
        .filter((o) => o.status !== 'COMPLETED')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
    const signature = batch.map((o) => o.id).join(',');
    if (pageFingerprints.has(signature))
      throw new Error(
        'Сервер повторяет страницу заказов. Показан предыдущий снимок; требуется синхронизация.',
      );
    pageFingerprints.add(signature);
    for (const o of batch) {
      const previous = orders.get(o.id);
      if (!previous || previous.version <= o.version) orders.set(o.id, o);
    }
  }
  throw new Error(
    'Слишком много страниц заказов. Снимок не усечён: обратитесь к администратору.',
  );
}
