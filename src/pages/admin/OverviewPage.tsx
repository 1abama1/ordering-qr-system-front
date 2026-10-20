import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  ChefHat,
  Clock3,
  QrCode,
  Utensils,
  UtensilsCrossed,
} from 'lucide-react';
import {
  ordersOptions,
  staffMenuOptions,
  tablesOptions,
} from '../../features/menu/queries';
import { ErrorState, Loading } from '../../shared/components/feedback/Feedback';
export default function OverviewPage() {
  const orders = useQuery(ordersOptions),
    menu = useQuery(staffMenuOptions),
    tables = useQuery(tablesOptions);
  const error = orders.error || menu.error || tables.error;
  const metrics = [
    {
      label: 'Активные заказы',
      value: orders.data?.length,
      icon: Utensils,
      hint: 'На кухне сейчас',
      link: '/kitchen',
    },
    {
      label: 'Ожидают приготовления',
      value: orders.data?.filter((o) => o.status === 'PENDING').length,
      icon: Clock3,
      hint: 'Новые заказы',
      link: '/kitchen',
    },
    {
      label: 'Готовятся',
      value: orders.data?.filter((o) => o.status === 'COOKING').length,
      icon: ChefHat,
      hint: 'В работе у команды',
      link: '/kitchen',
    },
    {
      label: 'Блюд в меню',
      value: menu.data?.length,
      icon: UtensilsCrossed,
      hint: `${menu.data?.filter((m) => !m.isAvailable).length ?? '—'} в стоп-листе`,
      link: '/admin/menu',
    },
    {
      label: 'Столиков',
      value: tables.data?.length,
      icon: QrCode,
      hint: `${tables.data?.filter((t) => t.isActive).length ?? '—'} активных`,
      link: '/admin/tables',
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">РЕСТОРАН В ДЕТАЛЯХ</span>
          <h1>
            Всё начинается с заботы<span className="heading-dot">.</span>
          </h1>
          <p className="muted">Текущая картина ресторана по данным сервера.</p>
        </div>
        <Link className="button button-primary" to="/kitchen">
          Открыть кухню <ArrowUpRight size={18} />
        </Link>
      </div>
      {error && (
        <ErrorState
          compact
          error={error}
          retry={() => {
            void Promise.all([
              orders.refetch(),
              menu.refetch(),
              tables.refetch(),
            ]);
          }}
        />
      )}
      {orders.isPending && menu.isPending && tables.isPending ? (
        <Loading />
      ) : (
        <div className="metrics-grid">
          {metrics.map(({ label, value, icon: Icon, hint, link }) => (
            <Link to={link} className="metric-card" key={label}>
              <div>
                <span className="metric-icon">
                  <Icon size={21} />
                </span>
                <ArrowUpRight size={17} />
              </div>
              <strong>{value ?? '—'}</strong>
              <h3>{label}</h3>
              <p>{hint}</p>
            </Link>
          ))}
        </div>
      )}
      <div className="overview-bottom">
        <section className="panel">
          <span className="eyebrow">ЕЖЕДНЕВНЫЕ ЗАДАЧИ</span>
          <h2>Ваш ресторан. Ваш ритм.</h2>
          <p className="muted">
            Обновляйте меню, следите за наличием и помогайте команде работать
            слаженно.
          </p>
          <Link to="/admin/menu">
            Редактировать меню <ArrowUpRight size={18} />
          </Link>
          <Link to="/admin/tables">
            Подготовить QR-коды <ArrowUpRight size={18} />
          </Link>
          <Link to="/kitchen/stop-list">
            Проверить стоп-лист <ArrowUpRight size={18} />
          </Link>
        </section>
        <section className="admin-note">
          <QrCode size={45} strokeWidth={1} />
          <h2>
            Меньше ожидания.
            <br />
            <em>Больше внимания гостям.</em>
          </h2>
          <p>
            QR-код связывает столик, меню и кухню.
            <br />
            Убедитесь, что на каждом столике актуальный код.
          </p>
          <Link to="/admin/tables">
            К столикам <ArrowUpRight size={17} />
          </Link>
        </section>
      </div>
    </>
  );
}
