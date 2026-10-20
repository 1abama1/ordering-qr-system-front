import { QueryClient } from '@tanstack/react-query';
import { normalizeError } from '../../shared/api/errors';
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => {
        const p = normalizeError(error).problem;
        return count < 1 && p.status >= 500;
      },
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});
