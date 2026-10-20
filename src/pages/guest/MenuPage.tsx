import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, ShoppingBag, Sparkles, X } from 'lucide-react';
import { useQr } from '../../features/qr-session/context';
import { useCatalog } from '../../features/menu/queries';
import { useCart, cartTotal } from '../../features/cart/store';
import { getAttempt } from '../../features/checkout/attempt';
import { money } from '../../shared/lib/money';
import {
  Empty,
  ErrorState,
  Loading,
} from '../../shared/components/feedback/Feedback';
import { MenuCard } from '../../widgets/menu-grid/MenuCard';
import { QrRequired } from './QrRequired';
export default function MenuPage() {
  const { session } = useQr();
  const catalog = useCatalog();
  const [category, setCategory] = useState<number | null>(null),
    [search, setSearch] = useState('');
  const lines = useCart((s) => s.lines);
  if (!session) return <QrRequired />;
  if (catalog.isPending) return <Loading label="Накрываем наше меню…" />;
  if (!catalog.data)
    return (
      <ErrorState
        error={catalog.error}
        retry={() => {
          void catalog.refetch();
        }}
      />
    );
  const { menu, categories } = catalog.data;
  const filtered = menu.filter(
    (m) =>
      m.isActive &&
      (!category || m.categoryId === category) &&
      m.name
        .toLocaleLowerCase('ru')
        .includes(search.trim().toLocaleLowerCase('ru')),
  );
  const count = lines.reduce((s, l) => s + l.quantity, 0);
  const selected = categories.find((c) => c.id === category);
  return (
    <>
      <section className="menu-hero">
        <div>
          <span className="eyebrow">
            <span /> ВАШ СТОЛИК УЖЕ ЖДЁТ
          </span>
          <h1>
            Выбирайте с аппетитом.
            <br />
            <em>Остальное — за нами.</em>
          </h1>
          <p>
            Любимые вкусы, свежие продукты и немного нашей души.
            <br className="desktop-only" /> Закажите к столику — без ожидания
            официанта.
          </p>
        </div>
        <div className="hero-note">
          <span className="note-line" />
          <span>
            Хороший день
            <br />
            начинается
            <br />
            <em>с хорошей еды.</em>
          </span>
          <Sparkles className="note-star" size={46} strokeWidth={0.9} />
        </div>
      </section>
      {catalog.isError && (
        <ErrorState
          compact
          error={catalog.error}
          retry={() => {
            void catalog.refetch();
          }}
        />
      )}
      {getAttempt() && (
        <Link className="notice" to="/cart">
          Есть неподтверждённая попытка заказа. Проверить результат{' '}
          <ArrowRight size={16} />
        </Link>
      )}
      <div className="catalog-toolbar">
        <nav className="categories" aria-label="Категории меню">
          <button
            className={!category ? 'active' : ''}
            onClick={() => setCategory(null)}
          >
            Всё меню <span>{menu.filter((m) => m.isActive).length}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={category === c.id ? 'active' : ''}
              onClick={() => setCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
        </nav>
        <div className="search">
          <Search size={18} />
          <input
            aria-label="Поиск блюд"
            placeholder="Найти что-нибудь вкусное"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button aria-label="Очистить поиск" onClick={() => setSearch('')}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="section-heading">
        <div>
          <span className="eyebrow">ПРИГОТОВЛЕНО ДЛЯ ВАС</span>
          <h2>
            {selected?.name || (search ? 'Результаты поиска' : 'Наше меню')}
            <span>{filtered.length}</span>
          </h2>
        </div>
        <p className="muted small">
          Выберите блюдо — мы приготовим его для вас
        </p>
      </div>
      {filtered.length ? (
        <div className="menu-grid">
          {filtered.map((item) => (
            <MenuCard
              key={item.id}
              item={item}
              category={categories.find((c) => c.id === item.categoryId)?.name}
            />
          ))}
        </div>
      ) : (
        <Empty
          title="Пока ничего не нашли"
          text="Попробуйте другое название или выберите другую категорию."
        />
      )}
      {count > 0 && (
        <Link className="checkout-bar" to="/cart" aria-label="Ваш заказ">
          <span>
            <ShoppingBag size={20} />
            <b>{count}</b>
            <span>Ваш заказ</span>
          </span>
          <strong>
            {money(cartTotal(lines, menu) / 100)} <ArrowRight size={18} />
          </strong>
        </Link>
      )}
    </>
  );
}
