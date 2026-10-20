import { NavLink } from 'react-router-dom';
import {
  ChartNoAxesCombined,
  ClipboardList,
  Grid2X2,
  QrCode,
  UsersRound,
  UtensilsCrossed,
} from 'lucide-react';
import { env } from '../../shared/config/env';
const links = [
  { to: '/admin', label: 'Обзор ресторана', icon: ChartNoAxesCombined },
  { to: '/admin/menu', label: 'Меню и блюда', icon: UtensilsCrossed },
  { to: '/admin/categories', label: 'Категории', icon: Grid2X2 },
  { to: '/admin/tables', label: 'Столики и QR', icon: QrCode },
  { to: '/admin/staff', label: 'Команда', icon: UsersRound },
];
export function AdminSidebar() {
  return (
    <aside className="admin-sidebar">
      <NavLink className="brand" to="/admin">
        <span className="brand-mark">
          <UtensilsCrossed size={23} />
        </span>
        <span>
          {env.restaurant}
          <small>управление рестораном</small>
        </span>
      </NavLink>
      <span className="nav-label">РАБОЧЕЕ ПРОСТРАНСТВО</span>
      <nav>
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/admin'}>
            <Icon size={19} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <span className="nav-label">ОПЕРАЦИОННАЯ РАБОТА</span>
        <NavLink to="/kitchen">
          <ClipboardList size={19} />
          Открыть кухню
        </NavLink>
        <p>
          Вкусный сервис начинается
          <br />с порядка в деталях.
        </p>
      </div>
    </aside>
  );
}
