import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  ChefHat,
  LayoutDashboard,
  LogOut,
  UtensilsCrossed,
} from 'lucide-react';
import { useAuth } from '../../features/auth/store';
import { RealtimeProvider } from '../../features/realtime/Provider';
import { Button } from '../../shared/components/ui/button';
import { Connection } from '../../shared/components/feedback/Connection';
export default function StaffLayout() {
  const { session, logout } = useAuth();
  if (!session) return null;
  return (
    <RealtimeProvider session={session}>
      <div className="kitchen-shell">
        <header className="kitchen-header">
          <Link className="brand" to="/kitchen">
            <span className="brand-mark">
              <ChefHat size={24} />
            </span>
            <span>
              DASTOR<small>кухонный дисплей</small>
            </span>
          </Link>
          <nav>
            <NavLink to="/kitchen" end>
              <ChefHat size={17} />
              Заказы
            </NavLink>
            <NavLink to="/kitchen/stop-list">
              <UtensilsCrossed size={17} />
              Стоп-лист
            </NavLink>
            {session.staff.role === 'ADMIN' && (
              <Link to="/admin">
                <LayoutDashboard size={17} />
                Управление
              </Link>
            )}
          </nav>
          <div className="header-actions">
            <Connection />
            <span className="staff-name">{session.staff.username}</span>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Выйти"
              onClick={logout}
            >
              <LogOut size={19} />
            </Button>
          </div>
        </header>
        <main className="kitchen-main">
          <Outlet />
        </main>
      </div>
    </RealtimeProvider>
  );
}
