import { z } from '../../shared/config/validation';
import { api } from '../../shared/api/client';
import { readStorage, writeStorage } from '../../shared/lib/storage';
export const QR_KEY = 'restaurant.qr.v1';
export const qrSessionSchema = z.object({
  tableNumber: z.number().int().min(1).max(10000),
  tableToken: z.string().min(1).max(256),
});
export type QrSession = z.infer<typeof qrSessionSchema>;
export function parseQr(search: string): QrSession | null {
  const p = new URLSearchParams(search);
  if (!p.has('table') && !p.has('token')) return null;
  const table = p.get('table') ?? '';
  if (
    !/^[1-9]\d{0,4}$/.test(table) ||
    p.getAll('table').length !== 1 ||
    p.getAll('token').length !== 1
  )
    throw new Error(
      'Некорректный QR-код. Отсканируйте актуальный код на столике.',
    );
  return qrSessionSchema.parse({
    tableNumber: Number(table),
    tableToken: p.get('token'),
  });
}
export function storedQr() {
  const r = qrSessionSchema.safeParse(readStorage(QR_KEY));
  return r.success ? r.data : null;
}
export async function validateQr(session: QrSession, signal?: AbortSignal) {
  const table = await api.resolve(
    session.tableNumber,
    session.tableToken,
    signal,
  );
  if (!table.isActive || table.number !== session.tableNumber)
    throw new Error('Столик недоступен. Отсканируйте актуальный QR.');
  writeStorage(QR_KEY, session);
  return session;
}
export function stripQrFromUrl() {
  const url = new URL(location.href);
  url.searchParams.delete('token');
  url.searchParams.delete('table');
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
}
