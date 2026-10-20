import { createContext, useContext } from 'react';
export type ConnectionState = 'connecting' | 'live' | 'degraded' | 'offline';
export const RealtimeContext = createContext<{
  state: ConnectionState;
  retry: () => void;
}>({ state: 'connecting', retry: () => {} });
export const useRealtime = () => useContext(RealtimeContext);
