import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { normalizeError } from '../../shared/api/errors';
import { QrContext } from './context';
import {
  parseQr,
  QR_KEY,
  storedQr,
  stripQrFromUrl,
  validateQr,
  type QrSession,
} from './session';
export function QrProvider({ children }: { children: ReactNode }) {
  const route = useLocation();
  const candidate = useRef<QrSession | null>(null);
  const [state, setState] = useState<{
    session: QrSession | null;
    checking: boolean;
    error: unknown;
  }>({ session: null, checking: true, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    async function run() {
      setState((s) => ({ ...s, checking: true, error: null }));
      try {
        const fromUrl = parseQr(location.search);
        if (fromUrl) {
          candidate.current = fromUrl;
          sessionStorage.removeItem(QR_KEY);
        }
        const qr = candidate.current ?? storedQr();
        stripQrFromUrl();
        if (!qr) {
          if (!disposed)
            setState({ session: null, checking: false, error: null });
          return;
        }
        const session = await validateQr(qr, controller.signal);
        if (!disposed) {
          candidate.current = null;
          setState({ session, checking: false, error: null });
        }
      } catch (error) {
        stripQrFromUrl();
        const p = normalizeError(error).problem;
        if (
          p.status === 403 ||
          p.code === 'TABLE_INACTIVE' ||
          p.status === 404
        ) {
          candidate.current = null;
          sessionStorage.removeItem(QR_KEY);
        }
        if (!disposed) setState({ session: null, checking: false, error });
      }
    }
    void run();
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [attempt, route.search]);
  return (
    <QrContext.Provider
      value={{
        ...state,
        retry: () => setAttempt((a) => a + 1),
        invalidate: () => {
          sessionStorage.removeItem(QR_KEY);
          candidate.current = null;
          setState({
            session: null,
            checking: false,
            error: new Error(
              'QR-код больше не действует. Отсканируйте актуальный код.',
            ),
          });
        },
      }}
    >
      {children}
    </QrContext.Provider>
  );
}
