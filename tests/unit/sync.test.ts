import { describe, expect, it, vi } from 'vitest';
import {
  createDirtySync,
  EventDeduplicator,
} from '../../src/features/realtime/sync';
import { loadActiveOrders } from '../../src/features/orders/snapshot';
import { eventSchema } from '../../src/shared/api/contracts';
import { order } from '../fixtures';
describe('authoritative synchronization', () => {
  it('serializes fetches and repeats when an event arrives during REST', async () => {
    let release: () => void = () => {};
    const load = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const sync = createDirtySync(load, vi.fn());
    const first = sync.request();
    void sync.request();
    void sync.request();
    expect(load).toHaveBeenCalledTimes(1);
    release();
    await first;
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('preserves availability for later retries after failure and stops on disposal', async () => {
    const onError = vi.fn();
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    const sync = createDirtySync(load, onError);
    await sync.request();
    expect(onError).toHaveBeenCalledOnce();
    await sync.request();
    expect(load).toHaveBeenCalledTimes(2);
    sync.dispose();
    await sync.request();
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('deduplicates notifications with bounded memory', () => {
    const seen = new EventDeduplicator();
    expect(seen.accept('id')).toBe(true);
    expect(seen.accept('id')).toBe(false);
    for (let i = 0; i < 1100; i++) seen.accept(String(i));
    expect(seen.accept('id')).toBe(true);
  });
  it('loads every page through the first empty response and uses newest versions', async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce([order])
      .mockResolvedValueOnce([
        { ...order, id: 43 },
        { ...order, version: 2 },
      ])
      .mockResolvedValueOnce([]);
    const result = await loadActiveOrders(undefined, loader);
    expect(loader).toHaveBeenCalledTimes(3);
    expect(result.map((o) => o.id)).toEqual([42, 43]);
    expect(result[0].version).toBe(2);
  });
  it('detects a repeating page instead of returning a truncated snapshot', async () => {
    await expect(
      loadActiveOrders(undefined, vi.fn().mockResolvedValue([order])),
    ).rejects.toThrow('повторяет');
  });
  it('accepts categories events with null menu fields', () => {
    expect(
      eventSchema.safeParse({
        eventId: 'id',
        type: 'CATEGORIES_CHANGED',
        occurredAt: '2026-10-20T00:00:00Z',
        menuItemId: null,
        isAvailable: null,
        version: null,
      }).success,
    ).toBe(true);
  });
});

it('repeats paginated snapshot when completion shifts pages during synchronization', async () => {
  let pass = 0;
  let snapshot = [order];
  const sync = createDirtySync(async () => {
    pass++;
    snapshot = await loadActiveOrders(undefined, async (page) => {
      if (page === 0) return pass === 1 ? [order] : [{ ...order, id: 43 }];
      if (pass === 1) void sync.request(); // completion event while page 1 is being fetched
      return [];
    });
  }, vi.fn());
  await sync.request();
  expect(pass).toBe(2);
  expect(snapshot.map((o) => o.id)).toEqual([43]);
});
