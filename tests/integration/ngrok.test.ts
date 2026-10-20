import { afterEach, expect, it, vi } from 'vitest';
import { AxiosHeaders, type AxiosAdapter } from 'axios';
import { auth } from '../fixtures';

vi.mock('../../src/shared/config/env', () => ({
  env: { apiUrl: 'https://test.ngrok-free.dev' },
}));

import { publicHttp, staffHttp } from '../../src/shared/api/http';
import { useAuth } from '../../src/features/auth/store';

const originalPublicAdapter = publicHttp.defaults.adapter;
const originalStaffAdapter = staffHttp.defaults.adapter;
afterEach(() => {
  publicHttp.defaults.adapter = originalPublicAdapter;
  staffHttp.defaults.adapter = originalStaffAdapter;
  useAuth.getState().logout();
});

it('bypasses the ngrok warning on public and staff requests without exposing staff credentials to public API', async () => {
  const seen: { path: string | undefined; skip: unknown; token: unknown }[] =
    [];
  const adapter: AxiosAdapter = async (config) => {
    seen.push({
      path: config.url,
      skip: config.headers.get('ngrok-skip-browser-warning'),
      token: config.headers.get('Authorization'),
    });
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      data: {},
    };
  };
  publicHttp.defaults.adapter = adapter;
  staffHttp.defaults.adapter = adapter;
  useAuth.getState().setSession({
    ...auth,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  await publicHttp.get('/api/menu');
  await staffHttp.get('/api/staff/auth/me');
  expect(seen).toEqual([
    { path: '/api/menu', skip: '1', token: undefined },
    {
      path: '/api/staff/auth/me',
      skip: '1',
      token: `Bearer ${auth.accessToken}`,
    },
  ]);
});
