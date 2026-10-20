import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { useCatalog, staffMenuOptions } from '../../features/menu/queries';
import { api } from '../../shared/api/client';
import type { MenuItem } from '../../shared/api/contracts';
import { errorMessage } from '../../shared/api/errors';
import { money } from '../../shared/lib/money';
import { Switch } from '../../shared/components/ui/switch';
import {
  Empty,
  ErrorState,
  Loading,
} from '../../shared/components/feedback/Feedback';
function StopRow({ item, category }: { item: MenuItem; category?: string }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (value: boolean) => api.availability(item.id, value),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: staffMenuOptions.queryKey }),
        qc.invalidateQueries({ queryKey: ['catalog'] }),
      ]);
      toast.success('Наличие обновлено');
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      void qc.invalidateQueries({ queryKey: staffMenuOptions.queryKey });
    },
  });
  return (
    <div className="stop-row">
      <div>
        <h3>{item.name}</h3>
        <span className="muted small">
          {category} · {money(item.price)}
          {!item.isActive && ' · Неактивное блюдо'}
        </span>
      </div>
      <span className={`badge ${item.isAvailable ? 'available' : 'stopped'}`}>
        {item.isAvailable ? 'В наличии' : 'Стоп-лист'}
      </span>
      <Switch
        checked={item.isAvailable}
        disabled={mutation.isPending || !item.isActive}
        onCheckedChange={(v) => mutation.mutate(v)}
        label={`Наличие: ${item.name}`}
      />
    </div>
  );
}
export default function StopListPage() {
  const menu = useQuery(staffMenuOptions),
    catalog = useCatalog();
  const [search, setSearch] = useState(''),
    [onlyStop, setOnlyStop] = useState(false);
  const list =
    menu.data?.filter(
      (m) =>
        m.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
        (!onlyStop || !m.isAvailable),
    ) ?? [];
  return (
    <>
      <div className="kds-heading">
        <div>
          <span className="eyebrow">АКТУАЛЬНОЕ НАЛИЧИЕ</span>
          <h1>Стоп-лист</h1>
          <p className="muted">
            Изменения появятся у гостей после подтверждения сервера.
          </p>
        </div>
        <span className="badge stopped">
          {menu.data?.filter((m) => !m.isAvailable).length ?? '—'} недоступно
        </span>
      </div>
      <div className="filter-bar">
        <div className="search">
          <Search size={18} />
          <input
            aria-label="Поиск в стоп-листе"
            placeholder="Поиск блюда"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={onlyStop}
            onChange={(e) => setOnlyStop(e.target.checked)}
          />
          Только стоп-лист
        </label>
      </div>
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
        <div className="stop-list">
          {list.map((item) => (
            <StopRow
              key={item.id}
              item={item}
              category={
                catalog.data?.categories.find((c) => c.id === item.categoryId)
                  ?.name
              }
            />
          ))}
        </div>
      ) : (
        <Empty
          title="Блюда не найдены"
          text="Измените фильтры или добавьте блюда в панели администратора."
        />
      )}
    </>
  );
}
