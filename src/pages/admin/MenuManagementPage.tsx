import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from '../../shared/config/validation';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { staffMenuOptions, useCatalog } from '../../features/menu/queries';
import { api } from '../../shared/api/client';
import type { Category, MenuItem } from '../../shared/api/contracts';
import { money } from '../../shared/lib/money';
import { errorMessage } from '../../shared/api/errors';
import { Button } from '../../shared/components/ui/button';
import { Dialog } from '../../shared/components/ui/dialog';
import { Field } from '../../shared/components/ui/form';
import {
  Empty,
  ErrorState,
  Loading,
} from '../../shared/components/feedback/Feedback';
const schema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(4000),
  price: z
    .string()
    .regex(/^\d{1,7}(\.\d{1,2})?$/, 'Цена от 0 до 9999999.99, до 2 знаков'),
  imageUrl: z.union([z.literal(''), z.url().regex(/^https?:\/\//)]),
  categoryId: z.string().min(1, 'Выберите категорию'),
  isAvailable: z.boolean(),
  isActive: z.boolean(),
});
function MenuForm({
  item,
  categories,
  done,
}: {
  item: MenuItem | null;
  categories: Category[];
  done: () => void;
}) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: item?.name ?? '',
      description: item?.description ?? '',
      price: String(item?.price ?? ''),
      imageUrl: item?.imageUrl ?? '',
      categoryId: item ? String(item.categoryId) : '',
      isAvailable: item?.isAvailable ?? true,
      isActive: item?.isActive ?? true,
    },
  });
  const mutation = useMutation({
    mutationFn: (v: z.infer<typeof schema>) =>
      api.saveMenu(
        {
          ...v,
          price: Number(v.price),
          categoryId: Number(v.categoryId),
          description: v.description || null,
          imageUrl: v.imageUrl || null,
        },
        item?.id,
      ),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: staffMenuOptions.queryKey }),
        qc.invalidateQueries({ queryKey: ['catalog'] }),
      ]);
      toast.success('Блюдо сохранено');
      done();
    },
  });
  const image = useWatch({ control, name: 'imageUrl' });
  return (
    <form
      className="stack-form"
      onSubmit={handleSubmit((v) => mutation.mutate(v))}
    >
      {mutation.error && <ErrorState compact error={mutation.error} />}
      <Field label="Название" error={errors.name?.message}>
        <input {...register('name')} />
      </Field>
      <Field label="Описание" error={errors.description?.message}>
        <textarea rows={3} {...register('description')} />
      </Field>
      <div className="form-columns">
        <Field label="Цена, сом" error={errors.price?.message}>
          <input inputMode="decimal" {...register('price')} />
        </Field>
        <Field label="Категория" error={errors.categoryId?.message}>
          <select {...register('categoryId')}>
            <option value="">Выберите…</option>
            {categories.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        label="Ссылка на фотографию"
        error={errors.imageUrl?.message}
        hint="Только HTTP(S). Загрузка файлов API не поддерживается."
      >
        <input type="url" {...register('imageUrl')} placeholder="https://…" />
      </Field>
      {/^https?:\/\//.test(image) && (
        <img
          className="image-preview"
          src={image}
          alt="Предпросмотр фотографии"
          referrerPolicy="no-referrer"
        />
      )}
      <label className="inline-check">
        <input type="checkbox" {...register('isAvailable')} />В наличии
      </label>
      <label className="inline-check">
        <input type="checkbox" {...register('isActive')} />
        Активно в гостевом меню
      </label>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Сохраняем…' : 'Сохранить блюдо'}
      </Button>
    </form>
  );
}
export default function MenuManagementPage() {
  const menu = useQuery(staffMenuOptions),
    catalog = useCatalog(),
    qc = useQueryClient();
  const [editing, setEditing] = useState<MenuItem | null | undefined>(),
    [deleting, setDeleting] = useState<MenuItem | null>(null),
    [search, setSearch] = useState('');
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteMenu(id),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: staffMenuOptions.queryKey }),
        qc.invalidateQueries({ queryKey: ['catalog'] }),
      ]);
      setDeleting(null);
      toast.success('Блюдо деактивировано');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const list =
    menu.data?.filter((m) =>
      m.name.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ВКУС В КАЖДОЙ ДЕТАЛИ</span>
          <h1>Меню и блюда</h1>
          <p className="muted">Состав меню, цены и доступность.</p>
        </div>
        <Button
          onClick={() => setEditing(null)}
          disabled={!catalog.data?.categories.length}
        >
          <Plus size={18} />
          Добавить блюдо
        </Button>
      </div>
      <div className="filter-bar">
        <div className="search">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Поиск в меню администратора"
            placeholder="Название блюда"
          />
        </div>
        <span className="muted small">
          {menu.data?.length ?? '—'} блюд всего
        </span>
      </div>
      {catalog.isError && (
        <ErrorState
          compact
          error={catalog.error}
          retry={() => {
            void catalog.refetch();
          }}
        />
      )}
      {menu.isError && (
        <ErrorState
          error={menu.error}
          retry={() => {
            void menu.refetch();
          }}
        />
      )}
      {menu.isPending ? (
        <Loading />
      ) : list.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Блюдо</th>
                <th>Категория</th>
                <th>Цена</th>
                <th>Состояние</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.id}>
                  <td>
                    <b>{m.name}</b>
                    <small className="table-description">{m.description}</small>
                  </td>
                  <td>
                    {catalog.data?.categories.find((c) => c.id === m.categoryId)
                      ?.name ?? '—'}
                  </td>
                  <td className="nowrap">{money(m.price)}</td>
                  <td>
                    <span
                      className={`badge ${!m.isActive ? '' : m.isAvailable ? 'available' : 'stopped'}`}
                    >
                      {!m.isActive
                        ? 'Неактивно'
                        : m.isAvailable
                          ? 'В наличии'
                          : 'Стоп-лист'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Редактировать ${m.name}`}
                        onClick={() => setEditing(m)}
                      >
                        <Pencil size={17} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Деактивировать ${m.name}`}
                        onClick={() => setDeleting(m)}
                      >
                        <Trash2 size={17} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="Меню пока пусто"
          text="Добавьте категорию, затем создайте первое блюдо."
        />
      )}
      <Dialog
        open={editing !== undefined}
        onOpenChange={(o) => {
          if (!o) setEditing(undefined);
        }}
        title={editing ? 'Редактировать блюдо' : 'Новое блюдо'}
      >
        {editing !== undefined && (
          <MenuForm
            key={editing?.id ?? 'new'}
            item={editing}
            categories={catalog.data?.categories ?? []}
            done={() => setEditing(undefined)}
          />
        )}
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
        title="Деактивировать блюдо?"
        description={`«${deleting?.name}» исчезнет из гостевого меню. История сохранится.`}
      >
        <Button
          variant="danger"
          disabled={remove.isPending}
          onClick={() => {
            if (deleting) remove.mutate(deleting.id);
          }}
        >
          Деактивировать
        </Button>
      </Dialog>
    </>
  );
}
