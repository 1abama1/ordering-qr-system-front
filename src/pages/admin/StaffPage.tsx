import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, UserPlus, UsersRound } from 'lucide-react';
import { api } from '../../shared/api/client';
import type { Staff } from '../../shared/api/contracts';
import { Button } from '../../shared/components/ui/button';
import { Field } from '../../shared/components/ui/form';
import { ErrorState } from '../../shared/components/feedback/Feedback';
const schema = z.object({
  username: z
    .string()
    .regex(/^[a-zA-Z0-9._-]{3,100}$/, '3–100 символов: латиница, цифры, . _ -'),
  password: z
    .string()
    .min(12, 'Минимум 12 символов')
    .refine(
      (v) => new TextEncoder().encode(v).length <= 72,
      'Не больше 72 байт UTF-8',
    ),
  role: z.enum(['ADMIN', 'KITCHEN']),
});
export default function StaffPage() {
  const [created, setCreated] = useState<Staff | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'KITCHEN' },
  });
  const mutation = useMutation({
    mutationFn: api.createStaff,
    onSuccess: (staff) => {
      setCreated(staff);
      reset({ username: '', password: '', role: 'KITCHEN' });
    },
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ВМЕСТЕ РАБОТАЕТ ЛУЧШЕ</span>
          <h1>Пригласите в команду</h1>
          <p className="muted">
            Создайте учётную запись для нового сотрудника.
          </p>
        </div>
        <UsersRound className="muted" size={34} />
      </div>
      <div className="staff-layout">
        <section className="panel">
          <h2>Новый сотрудник</h2>
          <form
            className="stack-form"
            onSubmit={handleSubmit((v) => {
              setCreated(null);
              mutation.mutate(v);
            })}
          >
            {mutation.error && <ErrorState compact error={mutation.error} />}
            {created && (
              <div className="notice success-notice">
                <Check size={22} />
                Сотрудник {created.username} создан. Роль: {created.role}.
              </div>
            )}
            <Field label="Логин" error={errors.username?.message}>
              <input autoComplete="off" {...register('username')} />
            </Field>
            <Field
              label="Пароль"
              error={errors.password?.message}
              hint="От 12 символов, максимум 72 UTF-8 байта."
            >
              <input
                type="password"
                autoComplete="new-password"
                {...register('password')}
              />
            </Field>
            <Field label="Роль" error={errors.role?.message}>
              <select {...register('role')}>
                <option value="KITCHEN">Кухня — заказы и стоп-лист</option>
                <option value="ADMIN">Администратор — полный доступ</option>
              </select>
            </Field>
            <Button type="submit" disabled={mutation.isPending}>
              <UserPlus size={18} />
              {mutation.isPending ? 'Создаём…' : 'Создать сотрудника'}
            </Button>
          </form>
        </section>
        <aside className="role-note">
          <h3>Доступ по роли</h3>
          <p>
            <b>Кухня</b>
            <br />
            Приём заказов, приготовление, завершение и актуальное наличие блюд.
          </p>
          <p>
            <b>Администратор</b>
            <br />
            Возможности кухни, управление меню, категориями, столиками и
            создание сотрудников.
          </p>
          <p className="small muted">
            Передайте реквизиты сотруднику безопасным способом. Пароль не
            сохраняется в приложении.
          </p>
        </aside>
      </div>
    </>
  );
}
