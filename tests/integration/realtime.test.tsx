import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { RealtimeProvider } from '../../src/features/realtime/Provider';
import { Connection } from '../../src/shared/components/feedback/Connection';
import { api } from '../../src/shared/api/client';
import { auth, item, order } from '../fixtures';
import type { RealtimeEvent } from '../../src/shared/api/contracts';
const transport = vi.hoisted(() => ({
  instances: [] as {
    options: {
      onConnect: () => void;
      onWebSocketClose: () => void;
      beforeConnect: () => void;
    };
    receipts: Map<string, () => void>;
    subscriptions: {
      destination: string;
      receipt: string;
      callback: (message: { body: string }) => void;
    }[];
    connectHeaders: Record<string, string>;
    deactivate: ReturnType<typeof vi.fn>;
    forceDisconnect: ReturnType<typeof vi.fn>;
  }[],
}));
vi.mock('@stomp/stompjs', () => ({
  Client: class {
    options;
    receipts = new Map();
    subscriptions: {
      destination: string;
      receipt: string;
      callback: (m: { body: string }) => void;
    }[] = [];
    connectHeaders = {};
    deactivate = vi.fn().mockResolvedValue(undefined);
    forceDisconnect = vi.fn();
    constructor(options: (typeof transport.instances)[number]['options']) {
      this.options = options;
      transport.instances.push(this);
    }
    activate() {}
    watchForReceipt(id: string, cb: () => void) {
      this.receipts.set(id, cb);
    }
    subscribe(
      destination: string,
      callback: (m: { body: string }) => void,
      headers: { receipt: string },
    ) {
      this.subscriptions.push({
        destination,
        callback,
        receipt: headers.receipt,
      });
    }
  },
}));
const toastInfo = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { info: toastInfo } }));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  transport.instances.length = 0;
  toastInfo.mockClear();
});
function mount(staff = false) {
  vi.spyOn(api, 'menu').mockResolvedValue([item]);
  vi.spyOn(api, 'categories').mockResolvedValue([]);
  vi.spyOn(api, 'staffMenu').mockResolvedValue([item]);
  vi.spyOn(api, 'activePage').mockResolvedValue([]);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={qc}>
      <RealtimeProvider session={staff ? auth : undefined}>
        <Connection />
      </RealtimeProvider>
    </QueryClientProvider>,
  );
  return { ...view, client: transport.instances[0], qc };
}
it('waits for every receipt, sends JWT only in CONNECT, and resyncs on reconnect', async () => {
  const { client, unmount } = mount(true);
  act(() => {
    client.options.beforeConnect();
    client.options.onConnect();
  });
  expect(client.connectHeaders).toEqual({
    Authorization: 'Bearer test-only-token',
  });
  expect(api.menu).not.toHaveBeenCalled();
  await act(async () => {
    client.receipts.get(client.subscriptions[0].receipt)!();
  });
  expect(api.menu).not.toHaveBeenCalled();
  await act(async () => {
    client.receipts.get(client.subscriptions[1].receipt)!();
  });
  await screen.findByText('Онлайн');
  expect(api.activePage).toHaveBeenCalledWith(0, expect.any(AbortSignal));
  act(() => client.options.onWebSocketClose());
  expect(screen.getByText('Обновление каждые 15 с')).toBeInTheDocument();
  act(() => client.options.onConnect());
  await act(async () => {
    client.subscriptions
      .slice(2)
      .forEach((s) => client.receipts.get(s.receipt)!());
  });
  await waitFor(() => expect(api.menu).toHaveBeenCalledTimes(2));
  unmount();
  expect(client.deactivate).toHaveBeenCalledWith({ force: true });
});
it('handles all five event variants as invalidations and deduplicates notifications', async () => {
  const { client } = mount(true);
  act(() => client.options.onConnect());
  await act(async () => {
    client.receipts.forEach((cb) => cb());
  });
  const events: RealtimeEvent[] = [
    {
      eventId: 'one',
      type: 'NEW_ORDER',
      occurredAt: order.createdAt,
      orderId: order.id,
      order,
    },
    {
      eventId: 'two',
      type: 'ORDER_STATUS_CHANGED',
      occurredAt: order.createdAt,
      orderId: order.id,
      order,
      previousStatus: 'PENDING',
      newStatus: 'COOKING',
      completedAt: null,
      version: 1,
    },
    {
      eventId: 'three',
      type: 'MENU_ITEM_AVAILABILITY_CHANGED',
      occurredAt: order.createdAt,
      menuItemId: 1,
      isAvailable: false,
      isActive: true,
      updatedAt: order.createdAt,
      version: 1,
    },
    {
      eventId: 'four',
      type: 'MENU_CHANGED',
      occurredAt: order.createdAt,
      menuItemId: 1,
      isAvailable: true,
      isActive: true,
      updatedAt: order.createdAt,
      version: 2,
    },
    {
      eventId: 'five',
      type: 'CATEGORIES_CHANGED',
      occurredAt: order.createdAt,
    },
  ];
  for (const event of [...events, events[0]])
    await act(async () => {
      client.subscriptions[0].callback({ body: JSON.stringify(event) });
    });
  expect(toastInfo).toHaveBeenCalledTimes(1);
  expect(api.menu).toHaveBeenCalledTimes(7);
});
it('reconnects on receipt timeout and polls while delivery is unconfirmed', async () => {
  vi.useFakeTimers();
  const { client } = mount();
  act(() => client.options.onConnect());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5001);
  });
  expect(client.forceDisconnect).toHaveBeenCalledOnce();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(api.menu).toHaveBeenCalledOnce();
});
it('does not retain subscriptions or timers after logout/unmount', async () => {
  vi.useFakeTimers();
  const { client, unmount } = mount(true);
  act(() => client.options.onConnect());
  unmount();
  await vi.advanceTimersByTimeAsync(30000);
  expect(client.deactivate).toHaveBeenCalledOnce();
  expect(api.menu).not.toHaveBeenCalled();
});

it('ends JWT session and closes protected transport at expiresAt', async () => {
  vi.useFakeTimers();
  const { useAuth } = await import('../../src/features/auth/store');
  const { AuthLifecycle } =
    await import('../../src/app/providers/AuthLifecycle');
  useAuth.getState().setSession({
    ...auth,
    expiresAt: new Date(Date.now() + 1000).toISOString(),
  });
  const qc = new QueryClient();
  function SessionView() {
    const session = useAuth((s) => s.session);
    return session ? (
      <RealtimeProvider session={session}>
        <Connection />
      </RealtimeProvider>
    ) : (
      <span>Нужен вход</span>
    );
  }
  render(
    <QueryClientProvider client={qc}>
      <AuthLifecycle />
      <SessionView />
    </QueryClientProvider>,
  );
  const client = transport.instances[0];
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1001);
  });
  expect(useAuth.getState().session).toBeNull();
  expect(screen.getByText('Нужен вход')).toBeInTheDocument();
  expect(client.deactivate).toHaveBeenCalledWith({ force: true });
});
