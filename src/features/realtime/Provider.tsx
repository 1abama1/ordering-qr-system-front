import { secureUuid } from '../../shared/lib/uuid';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Client } from '@stomp/stompjs';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { env } from '../../shared/config/env';
import { eventSchema, type AuthSession } from '../../shared/api/contracts';
import {
  catalogOptions,
  ordersOptions,
  staffMenuOptions,
} from '../menu/queries';
import { createDirtySync, EventDeduplicator } from './sync';
import { RealtimeContext, type ConnectionState } from './context';
import { playNewOrder } from '../kitchen/sound';
export function RealtimeProvider({
  session,
  children,
}: {
  session?: AuthSession;
  children: ReactNode;
}) {
  const qc = useQueryClient();
  const [state, setState] = useState<ConnectionState>('connecting');
  const [generation, setGeneration] = useState(0);
  const seen = useRef(new EventDeduplicator());
  useEffect(() => {
    let disposed = false,
      confirmed = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const sync = createDirtySync(
      async () => {
        await qc.invalidateQueries({
          queryKey: ['catalog'],
          refetchType: 'none',
        });
        if (disposed) return;
        const jobs: Promise<unknown>[] = [
          qc.fetchQuery({ ...catalogOptions, staleTime: 0 }),
        ];
        if (session) {
          await qc.invalidateQueries({
            queryKey: ['staff', 'orders'],
            refetchType: 'none',
          });
          await qc.invalidateQueries({
            queryKey: ['staff', 'menu'],
            refetchType: 'none',
          });
          if (disposed) return;
          jobs.push(
            qc.fetchQuery({ ...ordersOptions, staleTime: 0 }),
            qc.fetchQuery({ ...staffMenuOptions, staleTime: 0 }),
          );
        }
        await Promise.all(jobs);
        if (!disposed)
          setState(
            confirmed ? 'live' : navigator.onLine ? 'degraded' : 'offline',
          );
      },
      () => {
        if (!disposed) setState(navigator.onLine ? 'degraded' : 'offline');
      },
    );
    const clearReceipts = () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
    const client = new Client({
      brokerURL: env.wsUrl,
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      connectionTimeout: 10000,
      debug: () => {},
      beforeConnect: () => {
        client.connectHeaders = session
          ? { Authorization: `Bearer ${session.accessToken}` }
          : {};
      },
      onConnect: () => {
        if (disposed) return;
        confirmed = false;
        clearReceipts();
        const destinations = session
          ? ['/topic/menu/updates', '/topic/kitchen/orders']
          : ['/topic/menu/updates'];
        let remaining = destinations.length;
        for (const destination of destinations) {
          const receipt = secureUuid();
          const timeout = setTimeout(() => {
            if (!disposed) {
              confirmed = false;
              setState('degraded');
              client.forceDisconnect();
            }
          }, 5000);
          timers.add(timeout);
          client.watchForReceipt(receipt, () => {
            clearTimeout(timeout);
            timers.delete(timeout);
            if (!disposed && --remaining === 0) {
              confirmed = true;
              void sync.request();
            }
          });
          client.subscribe(
            destination,
            (message) => {
              if (disposed) return;
              void sync.request();
              try {
                const event = eventSchema.safeParse(JSON.parse(message.body));
                if (
                  event.success &&
                  seen.current.accept(event.data.eventId) &&
                  event.data.type === 'NEW_ORDER' &&
                  session
                ) {
                  toast.info(
                    `Новый заказ — столик №${event.data.order.tableNumber}`,
                  );
                  window.dispatchEvent(
                    new CustomEvent('restaurant:new-order', {
                      detail: event.data.orderId,
                    }),
                  );
                  playNewOrder();
                }
              } catch {
                /* Invalid event still triggers REST synchronization. Never log frames. */
              }
            },
            { receipt },
          );
        }
      },
      onWebSocketClose: () => {
        confirmed = false;
        clearReceipts();
        if (!disposed) setState(navigator.onLine ? 'degraded' : 'offline');
      },
      onStompError: () => {
        if (!disposed) {
          setState('degraded');
          client.forceDisconnect();
        }
      },
      onWebSocketError: () => {
        if (!disposed) setState(navigator.onLine ? 'degraded' : 'offline');
      },
    });
    client.activate();
    const poll = setInterval(() => {
      void sync.request();
    }, 15000);
    const visible = () => {
      if (document.visibilityState === 'visible') void sync.request();
    };
    const online = () => {
      void sync.request();
    };
    const offline = () => setState('offline');
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      disposed = true;
      sync.dispose();
      clearReceipts();
      clearInterval(poll);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      void client.deactivate({ force: true });
      void qc.cancelQueries({ queryKey: ['catalog'] });
      if (session) void qc.cancelQueries({ queryKey: ['staff'] });
    };
  }, [qc, session, generation]);
  return (
    <RealtimeContext.Provider
      value={{ state, retry: () => setGeneration((g) => g + 1) }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}
