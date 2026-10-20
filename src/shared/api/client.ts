import { publicHttp, staffHttp } from './http';
import {
  authSchema,
  categorySchema,
  menuItemSchema,
  orderSchema,
  qrSchema,
  staffSchema,
  tableSchema,
  type CategoryRequest,
  type CreateOrderRequest,
  type MenuRequest,
  type Staff,
} from './contracts';
export const api = {
  menu: async (signal?: AbortSignal) =>
    menuItemSchema.array().parse(
      (
        await publicHttp.get('/api/menu', {
          params: { includeUnavailable: true },
          signal,
        })
      ).data,
    ),
  categories: async (signal?: AbortSignal) =>
    categorySchema
      .array()
      .parse((await publicHttp.get('/api/categories', { signal })).data)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
  resolve: async (
    tableNumber: number,
    tableToken: string,
    signal?: AbortSignal,
  ) =>
    tableSchema.parse(
      (
        await publicHttp.get('/api/tables/resolve', {
          params: { tableNumber, tableToken },
          signal,
        })
      ).data,
    ),
  createOrder: async (body: CreateOrderRequest, key: string) => {
    const r = await publicHttp.post('/api/orders', body, {
      headers: { 'Idempotency-Key': key },
    });
    if (r.status !== 200 && r.status !== 201)
      throw new Error('Неожиданный статус ответа');
    return orderSchema.parse(r.data);
  },
  login: async (body: { username: string; password: string }) =>
    authSchema.parse(
      (await publicHttp.post('/api/staff/auth/login', body)).data,
    ),
  me: async () =>
    staffSchema.parse((await staffHttp.get('/api/staff/auth/me')).data),
  staffMenu: async (signal?: AbortSignal) =>
    menuItemSchema
      .array()
      .parse((await staffHttp.get('/api/staff/menu', { signal })).data),
  activePage: async (page: number, signal?: AbortSignal) =>
    orderSchema.array().parse(
      (
        await staffHttp.get('/api/orders/active', {
          params: { page, size: 200 },
          signal,
        })
      ).data,
    ),
  order: async (id: number) =>
    orderSchema.parse((await staffHttp.get(`/api/orders/${id}`)).data),
  cooking: async (id: number) =>
    orderSchema.parse(
      (await staffHttp.patch(`/api/orders/${id}/status`, { status: 'COOKING' }))
        .data,
    ),
  complete: async (id: number) =>
    orderSchema.parse(
      (await staffHttp.patch(`/api/orders/${id}/complete`)).data,
    ),
  availability: async (id: number, isAvailable: boolean) =>
    menuItemSchema.parse(
      (await staffHttp.patch(`/api/menu/${id}/availability`, { isAvailable }))
        .data,
    ),
  saveMenu: async (body: MenuRequest, id?: number) =>
    menuItemSchema.parse(
      (
        await (id
          ? staffHttp.put(`/api/menu/${id}`, body)
          : staffHttp.post('/api/menu', body))
      ).data,
    ),
  deleteMenu: async (id: number) => {
    await staffHttp.delete(`/api/menu/${id}`);
  },
  saveCategory: async (body: CategoryRequest, id?: number) =>
    categorySchema.parse(
      (
        await (id
          ? staffHttp.put(`/api/categories/${id}`, body)
          : staffHttp.post('/api/categories', body))
      ).data,
    ),
  deleteCategory: async (id: number) => {
    await staffHttp.delete(`/api/categories/${id}`);
  },
  tables: async (signal?: AbortSignal) =>
    tableSchema
      .array()
      .parse((await staffHttp.get('/api/staff/tables', { signal })).data),
  createTable: async (number: number) =>
    tableSchema.parse(
      (await staffHttp.post('/api/staff/tables', { number })).data,
    ),
  setTable: async (id: number, isActive: boolean) =>
    tableSchema.parse(
      (await staffHttp.patch(`/api/staff/tables/${id}`, { isActive })).data,
    ),
  qr: async (id: number) =>
    qrSchema.parse((await staffHttp.get(`/api/staff/tables/${id}/qr`)).data),
  qrPng: async (id: number) =>
    (
      await staffHttp.get<Blob>(`/api/staff/tables/${id}/qr`, {
        params: { format: 'png' },
        responseType: 'blob',
      })
    ).data,
  regenerate: async (id: number) =>
    qrSchema.parse(
      (await staffHttp.post(`/api/staff/tables/${id}/regenerate-token`)).data,
    ),
  createStaff: async (body: {
    username: string;
    password: string;
    role: Staff['role'];
  }) =>
    staffSchema.parse((await staffHttp.post('/api/staff/users', body)).data),
};
