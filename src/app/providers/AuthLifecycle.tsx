import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '../../features/auth/store';
export function AuthLifecycle() {
  const session = useAuth((s) => s.session),
    logout = useAuth((s) => s.logout),
    qc = useQueryClient();
  useEffect(() => {
    if (!session) {
      void qc
        .cancelQueries({ queryKey: ['staff'] })
        .then(() => qc.removeQueries({ queryKey: ['staff'] }));
      return;
    }
    let timeout: ReturnType<typeof setTimeout>;
    const check = () => {
      const left = Date.parse(session.expiresAt) - Date.now();
      if (left <= 0) {
        logout();
        toast.info('Сессия завершилась. Войдите снова.');
      } else timeout = setTimeout(check, Math.min(left, 2147483647));
    };
    check();
    return () => clearTimeout(timeout);
  }, [session, logout, qc]);
  return null;
}
