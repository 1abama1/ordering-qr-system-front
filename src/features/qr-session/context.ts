import { createContext, useContext } from 'react';
import type { QrSession } from './session';
export const QrContext = createContext<{
  session: QrSession | null;
  checking: boolean;
  error: unknown;
  retry: () => void;
  invalidate: () => void;
}>({
  session: null,
  checking: true,
  error: null,
  retry: () => {},
  invalidate: () => {},
});
export const useQr = () => useContext(QrContext);
