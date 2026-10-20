import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ShoppingBag, Trash2 } from 'lucide-react';
import { useQr } from '../../features/qr-session/context';
import { useCart, cartTotal } from '../../features/cart/store';
import { useCatalog } from '../../features/menu/queries';
import {
  buildOrder,
  clearAttempt,
  getAttempt,
  hasCorruptAttempt,
  saveAttempt,
} from '../../features/checkout/attempt';
import { validateQr } from '../../features/qr-session/session';
import { api } from '../../shared/api/client';
import { normalizeError } from '../../shared/api/errors';
import { writeStorage } from '../../shared/lib/storage';
import { money, toTyin } from '../../shared/lib/money';
import { Button } from '../../shared/components/ui/button';
import {
  Empty,
  ErrorState,
  Loading,
} from '../../shared/components/feedback/Feedback';
import { FoodImage, QuantityControl } from '../../widgets/menu-grid/MenuCard';
import { QrRequired } from './QrRequired';
export default function CartPage() {
  const qr = useQr(),
    catalog = useCatalog(),
    navigate = useNavigate();
  const { lines, remove, clear } = useCart();
  const [pending, setPending] = useState(getAttempt),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const [retryAt, setRetryAt] = useState(0),
    [now, setNow] = useState(Date.now);
  const lock = useRef(false);
  useEffect(() => {
    if (!retryAt) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, retryAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [retryAt]);
  async function checkout() {
    if (lock.current || !qr.session || Date.now() < retryAt) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      let attempt = getAttempt();
      if (
        attempt &&
        (attempt.body.tableNumber !== qr.session.tableNumber ||
          attempt.body.tableToken !== qr.session.tableToken)
      )
        throw new Error(
          'Предыдущая попытка относится к другому QR-коду. Обратитесь к сотруднику для проверки заказа.',
        );
      await validateQr(qr.session);
      if (!attempt) {
        const fresh = await catalog.refetch({ throwOnError: true });
        if (!fresh.data) throw new Error('Не удалось проверить меню');
        attempt = saveAttempt(buildOrder(qr.session, lines, fresh.data.menu));
      }
      setPending(attempt);
      const order = await api.createOrder(attempt.body, attempt.key);
      writeStorage('restaurant.confirmed.v1', order);
      clear();
      clearAttempt();
      setPending(null);
      navigate('/order/success', { replace: true });
    } catch (e) {
      const p = normalizeError(e).problem;
      if (p.code === 'MENU_ITEM_UNAVAILABLE' || p.status === 400) {
        clearAttempt();
        setPending(null);
        await catalog.refetch();
      }
      if (p.code === 'INVALID_TABLE_TOKEN' || p.code === 'TABLE_INACTIVE')
        qr.invalidate();
      if (p.retryAt) setRetryAt(p.retryAt);
      setError(e);
      setPending(getAttempt());
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!qr.session) return <QrRequired />;
  if (!catalog.data)
    return catalog.isError ? (
      <ErrorState
        error={catalog.error}
        retry={() => {
          void catalog.refetch();
        }}
      />
    ) : (
      <Loading />
    );
  const menu = catalog.data.menu;
  const invalid = lines.some(
    (l) =>
      !menu.find((m) => m.id === l.menuItemId && m.isActive && m.isAvailable),
  );
  const corrupt = hasCorruptAttempt();
  return (
    <section className="cart-page">
      <Link className="back-link" to="/menu">
        <ArrowLeft size={17} />
        Вернуться в меню
      </Link>
      <span className="eyebrow">НЕМНОГО ДО ВКУСНОГО</span>
      <h1>
        Ваш заказ<span className="heading-dot">.</span>
      </h1>
      <p className="muted">
        Столик {qr.session.tableNumber} · {lines.length} позиций ·{' '}
        {lines.reduce((s, l) => s + l.quantity, 0)} порций
      </p>
      {!!error && <ErrorState error={error} />}
      {pending && (
        <div className="notice warning">
          <ShoppingBag size={22} />
          <p>
            <b>Результат предыдущей отправки пока не подтверждён.</b>
            <br />
            Повторная проверка отправит тот же состав с прежним ключом. Корзина
            временно заблокирована.
          </p>
        </div>
      )}
      {corrupt && (
        <ErrorState
          error={
            new Error(
              'Повреждена сохранённая попытка заказа. Обратитесь к сотруднику перед новым заказом.',
            )
          }
        />
      )}
      {!lines.length && !pending ? (
        <>
          <Empty
            title="Здесь пока пусто"
            text="Самое время выбрать что-нибудь вкусное."
          />
          <Link className="button button-primary" to="/menu">
            Открыть меню <ArrowRight size={17} />
          </Link>
        </>
      ) : (
        <div className="cart-layout">
          <div className="cart-lines">
            {lines.map((line) => {
              const item = menu.find((m) => m.id === line.menuItemId);
              return (
                <article className="cart-line" key={line.menuItemId}>
                  {item ? (
                    <FoodImage item={item} />
                  ) : (
                    <div className="food-placeholder" />
                  )}
                  <div className="cart-line-info">
                    <h3>{item?.name ?? 'Блюдо удалено из меню'}</h3>
                    <p className="muted">
                      {item ? money(item.price) : 'Недоступно'}
                    </p>
                    {(!item?.isAvailable || !item.isActive) && (
                      <span className="danger-text">
                        Удалите недоступную позицию
                      </span>
                    )}
                    {item && (
                      <QuantityControl
                        item={item}
                        disabled={busy || !!pending}
                      />
                    )}
                  </div>
                  <div className="cart-line-end">
                    <b>
                      {item &&
                        money((toTyin(item.price) * line.quantity) / 100)}
                    </b>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Удалить ${item?.name ?? 'позицию'}`}
                      disabled={busy || !!pending}
                      onClick={() => remove(line.menuItemId)}
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </article>
              );
            })}
            <Button
              variant="ghost"
              disabled={busy || !!pending || !lines.length}
              onClick={clear}
            >
              <Trash2 size={16} />
              Очистить корзину
            </Button>
          </div>
          <aside className="order-summary">
            <span className="eyebrow">ВСЁ ГОТОВО?</span>
            <h2>К вашему столику</h2>
            <div className="summary-row">
              <span>Столик</span>
              <b>№ {qr.session.tableNumber}</b>
            </div>
            <div className="summary-row total">
              <span>Предварительно</span>
              <b>{money(cartTotal(lines, menu) / 100)}</b>
            </div>
            <p className="muted small">
              Окончательный состав и стоимость подтвердит ресторан. Оплата у
              сотрудника.
            </p>
            <Button
              className="w-full"
              disabled={
                busy ||
                corrupt ||
                (!pending && (invalid || !lines.length)) ||
                now < retryAt
              }
              onClick={() => {
                void checkout();
              }}
            >
              {busy
                ? 'Проверяем и отправляем…'
                : now < retryAt
                  ? 'Повторите после паузы'
                  : pending
                    ? 'Повторить проверку результата'
                    : 'Подтвердить заказ'}
              <ArrowRight size={18} />
            </Button>
            {invalid && !pending && (
              <p className="danger-text small">
                Уберите недоступные блюда, чтобы продолжить.
              </p>
            )}
            <span className="summary-footnote">
              Заказ отправляется прямо на кухню
            </span>
          </aside>
        </div>
      )}
    </section>
  );
}
