import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, ChefHat, Clock3, Maximize, Volume2 } from 'lucide-react';
import { ordersOptions } from '../../features/menu/queries';
import { enableSound } from '../../features/kitchen/sound';
import { api } from '../../shared/api/client';
import type { Order } from '../../shared/api/contracts';
import { elapsed, elapsedLabel, money } from '../../shared/lib/money';
import { errorMessage } from '../../shared/api/errors';
import { Button } from '../../shared/components/ui/button';
import {
  Empty,
  ErrorState,
  Loading,
} from '../../shared/components/feedback/Feedback';
function OrderCard({
  order,
  now,
  fresh,
}: {
  order: Order;
  now: number;
  fresh: boolean;
}) {
  const qc = useQueryClient(),
    age = elapsed(order.createdAt, now);
  const mutation = useMutation({
    mutationFn: (action: 'cook' | 'complete') =>
      action === 'cook' ? api.cooking(order.id) : api.complete(order.id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ordersOptions.queryKey });
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      void qc.invalidateQueries({ queryKey: ordersOptions.queryKey });
    },
  });
  return (
    <article className={`order-card ${fresh ? 'new-order' : ''}`}>
      <div className="order-card-head">
        <div>
          <span className="order-number">ЗАКАЗ #{order.id}</span>
          <h3>
            Столик <b>{order.tableNumber}</b>
          </h3>
        </div>
        <span
          className={`order-timer ${age >= 600 ? 'late' : age >= 300 ? 'attention' : ''}`}
        >
          <Clock3 size={14} />
          {elapsedLabel(age)}
        </span>
      </div>
      <div className="order-items">
        {order.items.map((i) => (
          <div key={i.menuItemId}>
            <strong>
              {i.quantity}
              <small>×</small>
            </strong>
            <span>{i.menuItemName}</span>
          </div>
        ))}
      </div>
      <div className="order-meta">
        <span>
          {new Intl.DateTimeFormat('ru', {
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(order.createdAt))}
        </span>
        <span>{money(order.totalAmount)}</span>
      </div>
      <div className="order-actions">
        {order.status === 'PENDING' && (
          <Button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate('cook')}
          >
            <ChefHat size={18} />
            Начать готовить
          </Button>
        )}
        <Button
          variant={order.status === 'COOKING' ? 'default' : 'secondary'}
          disabled={mutation.isPending}
          onClick={() => mutation.mutate('complete')}
        >
          <Check size={18} />
          Завершить заказ
        </Button>
      </div>
    </article>
  );
}
export default function KitchenPage() {
  const orders = useQuery(ordersOptions);
  const [now, setNow] = useState(Date.now),
    [sound, setSound] = useState(false),
    [fresh, setFresh] = useState<number | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const listener = (e: Event) => {
      if (e instanceof CustomEvent && typeof e.detail === 'number') {
        setFresh(e.detail);
        clearTimeout(timer);
        timer = setTimeout(() => setFresh(null), 8000);
      }
    };
    window.addEventListener('restaurant:new-order', listener);
    return () => {
      window.removeEventListener('restaurant:new-order', listener);
      clearTimeout(timer);
    };
  }, []);
  return (
    <>
      <div className="kds-heading">
        <div>
          <span className="eyebrow">ВСЁ ПОД КОНТРОЛЕМ</span>
          <h1>
            Кухня в работе
            <span className="active-count">{orders.data?.length ?? '—'}</span>
          </h1>
          <p className="muted">
            По времени поступления ·{' '}
            {new Intl.DateTimeFormat('ru', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }).format(now)}
          </p>
        </div>
        <div className="kds-tools">
          <Button
            variant="secondary"
            onClick={() => {
              void enableSound()
                .then(() => setSound(true))
                .catch(() => toast.error('Браузер не разрешил звук'));
            }}
          >
            <Volume2 size={17} />
            {sound ? 'Звук включён' : 'Включить звук'}
          </Button>
          {document.fullscreenEnabled && (
            <Button
              variant="secondary"
              size="icon"
              aria-label="Полный экран"
              onClick={() => {
                const promise = document.fullscreenElement
                  ? document.exitFullscreen()
                  : document.documentElement.requestFullscreen();
                void promise.catch(() =>
                  toast.error('Полноэкранный режим недоступен'),
                );
              }}
            >
              <Maximize size={18} />
            </Button>
          )}
        </div>
      </div>
      {orders.isError && (
        <ErrorState
          compact
          error={orders.error}
          retry={() => {
            void orders.refetch();
          }}
        />
      )}
      {orders.isPending ? (
        <Loading label="Синхронизируем заказы…" />
      ) : (
        <div className="kanban">
          {(['PENDING', 'COOKING'] as const).map((status) => {
            const list = orders.data?.filter((o) => o.status === status) ?? [];
            return (
              <section
                className={`kanban-column ${status.toLowerCase()}`}
                key={status}
              >
                <div className="kanban-title">
                  <span className="status-dot" />
                  <h2>{status === 'PENDING' ? 'Новые заказы' : 'Готовятся'}</h2>
                  <b>{list.length}</b>
                </div>
                {list.length ? (
                  <div className="order-grid">
                    {list.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        now={now}
                        fresh={fresh === order.id}
                      />
                    ))}
                  </div>
                ) : (
                  <Empty
                    title={
                      status === 'PENDING'
                        ? 'Все заказы приняты'
                        : 'Пока ничего не готовится'
                    }
                    text={
                      status === 'PENDING'
                        ? 'Новые заказы появятся здесь автоматически.'
                        : 'Начните приготовление в соседней колонке.'
                    }
                  />
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
