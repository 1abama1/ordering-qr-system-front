import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from '../../shared/config/validation';
import {
  Download,
  ExternalLink,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { tablesOptions } from '../../features/menu/queries';
import { api } from '../../shared/api/client';
import type { QrMetadata, RestaurantTable } from '../../shared/api/contracts';
import { errorMessage } from '../../shared/api/errors';
import { env } from '../../shared/config/env';
import { Button } from '../../shared/components/ui/button';
import { Dialog } from '../../shared/components/ui/dialog';
import { Field } from '../../shared/components/ui/form';
import { Switch } from '../../shared/components/ui/switch';
import {
  Empty,
  ErrorState,
  Loading,
} from '../../shared/components/feedback/Feedback';
function TableRow({
  table,
  openQr,
}: {
  table: RestaurantTable;
  openQr: () => void;
}) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (active: boolean) => api.setTable(table.id, active),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: tablesOptions.queryKey });
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      void qc.invalidateQueries({ queryKey: tablesOptions.queryKey });
    },
  });
  return (
    <article className="table-card">
      <div>
        <span className="eyebrow">СТОЛИК</span>
        <strong>{String(table.number).padStart(2, '0')}</strong>
        <span className={`badge ${table.isActive ? 'available' : ''}`}>
          {table.isActive ? 'Активен' : 'Неактивен'}
        </span>
      </div>
      <QrCode size={47} strokeWidth={0.9} />
      <div className="table-card-bottom">
        <Switch
          checked={table.isActive}
          disabled={mutation.isPending}
          onCheckedChange={(v) => mutation.mutate(v)}
          label={`Активность столика ${table.number}`}
        />
        <Button variant="secondary" onClick={openQr}>
          <QrCode size={16} />
          QR-код
        </Button>
      </div>
    </article>
  );
}
function QrPanel({ table }: { table: RestaurantTable }) {
  const [data, setData] = useState<{ meta: QrMetadata; blob: Blob } | null>(
      null,
    ),
    [url, setUrl] = useState(''),
    [error, setError] = useState<unknown>(null),
    [regenerate, setRegenerate] = useState(false),
    [generation, setGeneration] = useState(0),
    [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    void Promise.all([api.qr(table.id), api.qrPng(table.id)])
      .then(([meta, blob]) => {
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
          setData({ meta, blob });
        }
      })
      .catch((e) => {
        if (active) setError(e);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [table.id, generation]);
  async function renew() {
    setBusy(true);
    setError(null);
    try {
      await api.regenerate(table.id);
      setData(null);
      setRegenerate(false);
      setGeneration((g) => g + 1);
      await qc.invalidateQueries({ queryKey: tablesOptions.queryKey });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {!!error && (
        <ErrorState
          compact
          error={error}
          retry={() => {
            setError(null);
            setGeneration((g) => g + 1);
          }}
        />
      )}
      {!data ? (
        !error && <Loading label="Получаем защищённый QR…" />
      ) : (
        <>
          <div className="qr-print">
            <h2>{env.restaurant}</h2>
            <p>Меню и заказ · Столик {table.number}</p>
            {url && <img src={url} alt={`QR-код столика ${table.number}`} />}
            <small>Отсканируйте камерой телефона</small>
          </div>
          <div className="qr-actions">
            <a
              className="button button-secondary"
              href={url}
              download={`table-${table.number}.png`}
            >
              <Download size={17} />
              Скачать PNG
            </a>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={17} />
              Печать
            </Button>
            <a
              className="button button-ghost"
              href={data.meta.url}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={17} />
              Открыть меню
            </a>
          </div>
          <p className="small muted">
            Версия QR: {data.meta.qrTokenVersion}. Адрес меню задаётся
            настройкой backend GUEST_MENU_URL.
          </p>
          <Button variant="ghost" onClick={() => setRegenerate(true)}>
            <RotateCcw size={16} />
            Перевыпустить QR
          </Button>
        </>
      )}
      <Dialog
        open={regenerate}
        onOpenChange={setRegenerate}
        title="Перевыпустить QR-код?"
        description="Ранее распечатанные коды этого столика перестанут работать. Новый QR нужно скачать и распечатать заново."
      >
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => {
            void renew();
          }}
        >
          {busy ? 'Перевыпускаем…' : 'Перевыпустить и отозвать старый QR'}
        </Button>
      </Dialog>
    </>
  );
}
const createSchema = z.object({
  number: z.string().regex(/^[1-9]\d{0,3}$|^10000$/, 'Номер от 1 до 10000'),
});
function NewTableForm({ done }: { done: () => void }) {
  const qc = useQueryClient(),
    {
      register,
      handleSubmit,
      formState: { errors },
    } = useForm<z.infer<typeof createSchema>>({
      resolver: zodResolver(createSchema),
    });
  const mutation = useMutation({
    mutationFn: (v: z.infer<typeof createSchema>) =>
      api.createTable(Number(v.number)),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: tablesOptions.queryKey });
      done();
    },
  });
  return (
    <form
      className="stack-form"
      onSubmit={handleSubmit((v) => mutation.mutate(v))}
    >
      {mutation.error && <ErrorState compact error={mutation.error} />}
      <Field
        label="Номер столика"
        error={errors.number?.message}
        hint="После создания номер изменить нельзя."
      >
        <input type="number" min="1" max="10000" {...register('number')} />
      </Field>
      <Button type="submit" disabled={mutation.isPending}>
        Создать столик
      </Button>
    </form>
  );
}
export default function TablesPage() {
  const tables = useQuery(tablesOptions),
    [creating, setCreating] = useState(false),
    [qr, setQr] = useState<RestaurantTable | null>(null);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">КАЖДОМУ ГОСТЮ — СВОЁ МЕСТО</span>
          <h1>Столики и QR-коды</h1>
          <p className="muted">
            Управляйте столиками и печатайте актуальные коды меню.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus size={18} />
          Добавить столик
        </Button>
      </div>
      {tables.isError && (
        <ErrorState
          error={tables.error}
          retry={() => {
            void tables.refetch();
          }}
        />
      )}
      {tables.isPending ? (
        <Loading />
      ) : tables.data?.length ? (
        <div className="tables-grid">
          {tables.data.map((t) => (
            <TableRow key={t.id} table={t} openQr={() => setQr(t)} />
          ))}
        </div>
      ) : (
        <Empty
          title="Добавьте первый столик"
          text="После создания станет доступен персональный QR-код."
        />
      )}
      <Dialog open={creating} onOpenChange={setCreating} title="Новый столик">
        {creating && <NewTableForm done={() => setCreating(false)} />}
      </Dialog>
      <Dialog
        open={!!qr}
        onOpenChange={(o) => {
          if (!o) setQr(null);
        }}
        title={`QR-код · Столик ${qr?.number ?? ''}`}
      >
        {qr && <QrPanel key={qr.id} table={qr} />}
      </Dialog>
    </>
  );
}
