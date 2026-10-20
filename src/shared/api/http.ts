import axios from 'axios';
import { env } from '../config/env';
import { useAuth } from '../../features/auth/store';
import { normalizeError } from './errors';
const apiHostname = env.apiUrl ? new URL(env.apiUrl).hostname : '';
const headers = /\.(ngrok-free\.(dev|app)|ngrok\.io)$/.test(apiHostname)
  ? { 'ngrok-skip-browser-warning': '1' }
  : undefined;
export const publicHttp = axios.create({
  baseURL: env.apiUrl,
  timeout: 15000,
  headers,
});
export const staffHttp = axios.create({
  baseURL: env.apiUrl,
  timeout: 15000,
  headers,
});
staffHttp.interceptors.request.use((config) => {
  const session = useAuth.getState().session;
  if (session && Date.parse(session.expiresAt) > Date.now())
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  else {
    useAuth.getState().logout();
    throw new Error('Сессия истекла. Войдите снова.');
  }
  return config;
});
for (const client of [publicHttp, staffHttp])
  client.interceptors.response.use(
    (r) => r,
    (error: unknown) => {
      const normalized = normalizeError(error);
      if (client === staffHttp && normalized.problem.status === 401)
        useAuth.getState().logout();
      return Promise.reject(normalized);
    },
  );
