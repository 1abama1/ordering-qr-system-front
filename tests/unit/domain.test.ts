import { describe, expect, it, beforeEach } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import {
  cartTotal,
  changeQuantity,
  useCart,
} from '../../src/features/cart/store';
import {
  buildOrder,
  getAttempt,
  saveAttempt,
} from '../../src/features/checkout/attempt';
import {
  parseQr,
  storedQr,
  stripQrFromUrl,
  QR_KEY,
} from '../../src/features/qr-session/session';
import {
  elapsed,
  elapsedLabel,
  money,
  toTyin,
} from '../../src/shared/lib/money';
import { normalizeError } from '../../src/shared/api/errors';
import { item, tea } from '../fixtures';
const session = { tableNumber: 3, tableToken: 'opaque-test-only-token' };
beforeEach(() => {
  sessionStorage.clear();
  useCart.setState({ lines: [], tableNumber: null });
});
describe('cart and money', () => {
  it('calculates using integer tyin', () => {
    expect(
      cartTotal(
        [
          { menuItemId: 1, quantity: 2 },
          { menuItemId: 2, quantity: 1 },
        ],
        [item, tea],
      ),
    ).toBe(72000);
    expect(
      cartTotal([{ menuItemId: 1, quantity: 3 }], [{ ...item, price: 0.1 }]),
    ).toBe(30);
    expect(toTyin(0.29)).toBe(29);
  });
  it('adds, increments and removes without mutating previous state', () => {
    const before = [{ menuItemId: 1, quantity: 1 }];
    expect(changeQuantity(before, item, 1)[0].quantity).toBe(2);
    expect(before[0].quantity).toBe(1);
    expect(changeQuantity(before, item, -1)).toEqual([]);
  });
  it('blocks unavailable and inactive additions but permits removal', () => {
    expect(changeQuantity([], { ...item, isAvailable: false }, 1)).toEqual([]);
    expect(changeQuantity([], { ...item, isActive: false }, 1)).toEqual([]);
    expect(
      changeQuantity(
        [{ menuItemId: 1, quantity: 1 }],
        { ...item, isAvailable: false },
        -1,
      ),
    ).toEqual([]);
  });
  it('enforces quantity and distinct item limits', () => {
    const max = [{ menuItemId: 1, quantity: 100 }];
    expect(changeQuantity(max, item, 1)).toEqual(max);
    const lines = Array.from({ length: 50 }, (_, i) => ({
      menuItemId: i + 1,
      quantity: 1,
    }));
    expect(changeQuantity(lines, { ...item, id: 51 }, 1)).toHaveLength(50);
  });
  it('binds cart to a confirmed table', () => {
    useCart.getState().bindTable(3);
    useCart.getState().change(item, 1);
    useCart.getState().bindTable(3);
    expect(useCart.getState().lines).toHaveLength(1);
    useCart.getState().bindTable(4);
    expect(useCart.getState().lines).toEqual([]);
  });
  it('formats KGS without floating artifacts', () => {
    expect(money(720)).toContain('720');
    expect(money(0.1 + 0.2)).toContain('0,3');
    expect(money(100)).toContain('сом');
  });
});
describe('checkout snapshots', () => {
  it('sends only server-supported fields', () => {
    expect(
      buildOrder(session, [{ menuItemId: 1, quantity: 2 }], [item]),
    ).toEqual({ ...session, items: [{ menuItemId: 1, quantity: 2 }] });
  });
  it('rejects unavailable, empty and oversized requests', () => {
    expect(() => buildOrder(session, [], [item])).toThrow();
    expect(() =>
      buildOrder(session, [{ menuItemId: 1, quantity: 101 }], [item]),
    ).toThrow();
    expect(() =>
      buildOrder(
        session,
        [{ menuItemId: 1, quantity: 1 }],
        [{ ...item, isAvailable: false }],
      ),
    ).toThrow();
  });
  it('persists before sending and preserves original key/body on retry', () => {
    const body = buildOrder(session, [{ menuItemId: 1, quantity: 2 }], [item]);
    const attempt = saveAttempt(body);
    body.items[0].quantity = 8;
    expect(getAttempt()?.body.items[0].quantity).toBe(2);
    expect(saveAttempt({ ...body, items: [] })).toEqual(attempt);
  });
});
describe('QR', () => {
  it('reads table/token without decoding the opaque credential format', () => {
    expect(parseQr('?table=3&token=opaque%2Btoken')).toEqual({
      tableNumber: 3,
      tableToken: 'opaque+token',
    });
    expect(parseQr('')).toBeNull();
  });
  it.each([
    '?table=0&token=t',
    '?table=-1&token=t',
    '?table=3.5&token=t',
    '?table=10001&token=t',
    '?table=3',
    '?table=3&table=4&token=t',
    '?token=t',
  ])('rejects malformed QR %s', (value) =>
    expect(() => parseQr(value)).toThrow(),
  );
  it('restores only valid tab-scoped data and strips sensitive query', () => {
    sessionStorage.setItem(QR_KEY, JSON.stringify(session));
    expect(storedQr()).toEqual(session);
    history.replaceState({}, '', '/menu?table=3&token=test&filter=hot#top');
    stripQrFromUrl();
    expect(location.pathname + location.search + location.hash).toBe(
      '/menu?filter=hot#top',
    );
  });
});
describe('errors and timers', () => {
  it('normalizes nginx short problems with Retry-After', () => {
    const e = new AxiosError(
      'request failed',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 429,
        statusText: '',
        data: { status: 429, code: 'RATE_LIMITED', detail: 'Slow down' },
        headers: new AxiosHeaders({ 'retry-after': '60' }),
        config: { headers: new AxiosHeaders() },
      },
    );
    const p = normalizeError(e).problem;
    expect(p.code).toBe('RATE_LIMITED');
    expect(p.retryAt).toBeGreaterThan(Date.now() + 59000);
  });
  it('normalizes unknown and network errors', () => {
    expect(normalizeError(new AxiosError('offline')).problem.code).toBe(
      'NETWORK_ERROR',
    );
    expect(normalizeError('unknown').problem.detail).toBeTruthy();
  });
  it('clamps clock skew and formats elapsed once per KDS tick', () => {
    expect(
      elapsed('2026-10-20T10:00:00Z', Date.parse('2026-10-20T09:59:00Z')),
    ).toBe(0);
    expect(elapsedLabel(367)).toBe('06:07');
    expect(elapsed('bad')).toBe(0);
  });
});

it('preserves full Problem Details diagnostics as well as abbreviated gateway errors', () => {
  const details = {
    status: 409,
    code: 'CONCURRENT_UPDATE',
    detail: 'Conflict',
    type: 'about:blank',
    title: 'Conflict',
    instance: '/api/menu/1',
    path: '/api/menu/1',
    timestamp: '2026-10-20T00:00:00Z',
    correlationId: 'test-correlation',
  };
  const error = new AxiosError(
    'conflict',
    'ERR_BAD_REQUEST',
    undefined,
    undefined,
    {
      status: 409,
      statusText: 'Conflict',
      data: details,
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
    },
  );
  expect(normalizeError(error).problem).toMatchObject(details);
});
