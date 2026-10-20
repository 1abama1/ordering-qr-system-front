import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from '../../shared/config/validation';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  UtensilsCrossed,
} from 'lucide-react';
import { api } from '../../shared/api/client';
import { useAuth } from '../../features/auth/store';
import { Button } from '../../shared/components/ui/button';
import { ErrorState } from '../../shared/components/feedback/Feedback';
import { env } from '../../shared/config/env';
const schema = z.object({
  username: z.string().trim().min(1, 'Введите логин').max(100),
  password: z.string().min(1, 'Введите пароль').max(72),
});
export default function LoginPage() {
  const navigate = useNavigate(),
    location = useLocation(),
    auth = useAuth();
  const [error, setError] = useState<unknown>(null),
    [show, setShow] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    resetField,
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  async function login(body: z.infer<typeof schema>) {
    setError(null);
    try {
      const session = await api.login(body);
      auth.setSession(session);
      const staff = await api.me();
      auth.setSession({ ...session, staff });
      resetField('password');
      const state = z.object({ from: z.string() }).safeParse(location.state);
      const from = state.success ? state.data.from : '';
      const allowed =
        /^\/(kitchen(?:\/stop-list)?|admin(?:\/(?:menu|categories|tables|staff))?)$/.test(
          from,
        ) &&
        (staff.role === 'ADMIN' || from.startsWith('/kitchen'));
      navigate(
        allowed ? from : staff.role === 'ADMIN' ? '/admin' : '/kitchen',
        { replace: true },
      );
    } catch (e) {
      auth.logout();
      setError(e);
    }
  }
  return (
    <div className="login-page">
      <div className="login-story">
        <Link className="brand" to="/">
          <span className="brand-mark">
            <UtensilsCrossed />
          </span>
          {env.restaurant}
        </Link>
        <div>
          <span className="eyebrow">ЗА КАЖДЫМ ВКУСНЫМ МОМЕНТОМ</span>
          <h1>
            Одна команда.
            <br />
            <em>Тысячи довольных гостей.</em>
          </h1>
          <p>Всё для слаженной работы ресторана в одном пространстве.</p>
        </div>
        <small>Меню · Кухня · Управление рестораном</small>
      </div>
      <main className="login-form-side">
        <Link className="back-link" to="/">
          <ArrowLeft size={16} />К гостевому меню
        </Link>
        <form className="login-form" onSubmit={handleSubmit(login)}>
          <span className="eyebrow">ПРОСТРАНСТВО КОМАНДЫ</span>
          <h2>С возвращением</h2>
          <p className="muted">Войдите, чтобы начать рабочий день.</p>
          {!!error && <ErrorState compact error={error} />}
          <label>
            Логин
            <input
              autoComplete="username"
              autoCapitalize="none"
              {...register('username')}
              placeholder="Ваш логин"
            />
          </label>
          {errors.username && (
            <span className="field-error">{errors.username.message}</span>
          )}
          <label>
            Пароль
            <div className="password-input">
              <input
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                {...register('password')}
                placeholder="Введите пароль"
              />
              <button
                type="button"
                aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {errors.password && (
            <span className="field-error">{errors.password.message}</span>
          )}
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Проверяем доступ…' : 'Войти в систему'}
            <ArrowRight size={18} />
          </Button>
          <p className="small muted">
            Доступ для сотрудников ресторана. Если вы забыли пароль, обратитесь
            к администратору.
          </p>
        </form>
      </main>
    </div>
  );
}
