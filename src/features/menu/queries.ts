import { queryOptions, useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { loadActiveOrders } from '../orders/snapshot';
export const catalogOptions = queryOptions({
  queryKey: ['catalog'],
  queryFn: async ({ signal }) => {
    const [menu, categories] = await Promise.all([
      api.menu(signal),
      api.categories(signal),
    ]);
    return { menu, categories };
  },
  staleTime: 10000,
});
export const staffMenuOptions = queryOptions({
  queryKey: ['staff', 'menu'],
  queryFn: ({ signal }) => api.staffMenu(signal),
  staleTime: 10000,
});
export const ordersOptions = queryOptions({
  queryKey: ['staff', 'orders'],
  queryFn: ({ signal }) => loadActiveOrders(signal),
  staleTime: 10000,
});
export const tablesOptions = queryOptions({
  queryKey: ['staff', 'tables'],
  queryFn: ({ signal }) => api.tables(signal),
  staleTime: 10000,
});
export const useCatalog = () => useQuery(catalogOptions);
