import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './store';
export function Guard({ admin = false }: { admin?: boolean }) {
  const { session } = useAuth();
  const route = useLocation();
  if (!session)
    return (
      <Navigate to="/staff/login" state={{ from: route.pathname }} replace />
    );
  if (admin && session.staff.role !== 'ADMIN')
    return <Navigate to="/403" replace />;
  return <Outlet />;
}
