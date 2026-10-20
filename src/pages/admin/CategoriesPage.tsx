import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from '../../shared/config/validation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useCatalog } from '../../features/menu/queries';
import { api } from '../../shared/api/client';
import type { Category } from '../../shared/api/contracts';
import { Button } from '../../shared/components/ui/button';
import { Dialog } from '../../shared/components/ui/dialog';
import { Field } from '../../shared/components/ui/form';
import {
  Empty,
  ErrorState,
  Loading,
} from '../../shared/components/feedback/Feedback';
const schema = z.object({
  name: z.string().trim().min(1).max(100),
  sortOrder: z.string().regex(/^\d{1,9}$/, 'Введите целое число от 0'),
});
function CategoryForm({
  category,
  done,
}: {
  category: Category | null;
  done: () => void;
}) {
  const qc = useQueryClient(),
    {
      register,
      handleSubmit,
      formState: { errors },
    } = useForm<z.infer<typeof schema>>({
      resolver: zodResolver(schema),
      defaultValues: {
        name: category?.name ?? '',
        sortOrder: String(category?.sortOrder ?? 0),
      },
    });
  const mutation = useMutation({
    mutationFn: (v: z.infer<typeof schema>) =>
      api.saveCategory(
        { name: v.name, sortOrder: Number(v.sortOrder) },
        category?.id,
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['catalog'] });
      done();
    },
  });
  return (
    <form
      className="stack-form"
      onSubmit={handleSubmit((v) => mutation.mutate(v))}
    >
      {mutation.error && <ErrorState compact error={mutation.error} />}
      <Field label="Название" error={errors.name?.message}>
        <input {...register('name')} />
      </Field>
      <Field label="Порядок сортировки" error={errors.sortOrder?.message}>
        <input type="number" min="0" {...register('sortOrder')} />
      </Field>
      <Button type="submit" disabled={mutation.isPending}>
        Сохранить категорию
      </Button>
    </form>
  );
}
export default function CategoriesPage() {
  const catalog = useCatalog(),
    qc = useQueryClient(),
    [editing, setEditing] = useState<Category | null | undefined>(),
    [deleting, setDeleting] = useState<Category | null>(null);
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteCategory(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['catalog'] });
      setDeleting(null);
    },
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ПОРЯДОК В МЕНЮ</span>
          <h1>Категории</h1>
          <p className="muted">Помогите гостям быстрее найти любимое.</p>
        </div>
        <Button onClick={() => setEditing(null)}>
          <Plus size={18} />
          Добавить категорию
        </Button>
      </div>
      {catalog.isError && (
        <ErrorState
          error={catalog.error}
          retry={() => {
            void catalog.refetch();
          }}
        />
      )}
      {catalog.isPending ? (
        <Loading />
      ) : catalog.data?.categories.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Категория</th>
                <th>Порядок</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {catalog.data.categories.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b>{c.name}</b>
                  </td>
                  <td>{c.sortOrder}</td>
                  <td>
                    <div className="row-actions">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Редактировать ${c.name}`}
                        onClick={() => setEditing(c)}
                      >
                        <Pencil size={17} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Удалить ${c.name}`}
                        onClick={() => {
                          remove.reset();
                          setDeleting(c);
                        }}
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
          title="Создайте первую категорию"
          text="Например: горячие блюда, салаты или напитки."
        />
      )}
      <Dialog
        open={editing !== undefined}
        onOpenChange={(o) => {
          if (!o) setEditing(undefined);
        }}
        title={editing ? 'Редактировать категорию' : 'Новая категория'}
      >
        {editing !== undefined && (
          <CategoryForm
            key={editing?.id ?? 'new'}
            category={editing}
            done={() => setEditing(undefined)}
          />
        )}
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
        title="Удалить категорию?"
        description={deleting?.name}
      >
        {remove.error && <ErrorState compact error={remove.error} />}
        <Button
          variant="danger"
          disabled={remove.isPending}
          onClick={() => {
            if (deleting) remove.mutate(deleting.id);
          }}
        >
          Удалить категорию
        </Button>
      </Dialog>
    </>
  );
}
