import { Link, Outlet, useLocation } from 'react-router-dom';
import { ExternalLink, LogOut } from 'lucide-react';
import { useAuth } from '../../features/auth/store';
import { RealtimeProvider } from '../../features/realtime/Provider';
import { AdminSidebar } from '../../widgets/admin-sidebar/AdminSidebar';
import { Connection } from '../../shared/components/feedback/Connection';
import { Button } from '../../shared/components/ui/button';
const names: Record<string, string> = {
  '/admin': 'Обзор ресторана',
  '/admin/menu': 'Меню и блюда',
  '/admin/categories': 'Категории',
  '/admin/tables': 'Столики и QR',
  '/admin/staff': 'Команда',
};
export default function AdminLayout() {
  const { session, logout } = useAuth(),
    location = useLocation();
  if (!session) return null;
  return (
    <RealtimeProvider session={session}>
      <div className="admin-shell">
        <AdminSidebar />
        <div className="admin-workspace">
          <header className="admin-header">
            <span className="breadcrumb">
              Ресторан <span>/</span> <b>{names[location.pathname]}</b>
            </span>
            <div className="header-actions">
              <Connection />
              <Link className="small muted" to="/menu">
                <ExternalLink size={15} />
                Меню гостя
              </Link>
              <span className="avatar">
                {session.staff.username.slice(0, 1).toUpperCase()}
              </span>
              <span className="staff-name">
                {session.staff.username}
                <small>Администратор</small>
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Выйти"
                onClick={logout}
              >
                <LogOut size={18} />
              </Button>
            </div>
          </header>
          <main className="admin-main">
            <Outlet />
          </main>
        </div>
      </div>
    </RealtimeProvider>
  );
}
