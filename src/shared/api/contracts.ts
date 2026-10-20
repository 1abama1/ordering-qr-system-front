import { z } from '../config/validation';
const id = z.number().int().positive();
export const menuItemSchema = z.object({
  id,
  name: z.string(),
  description: z.string().nullable(),
  price: z.number().nonnegative(),
  currency: z.literal('KGS'),
  imageUrl: z.string().nullable(),
  categoryId: id,
  isAvailable: z.boolean(),
  isActive: z.boolean(),
  updatedAt: z.string(),
  version: z.number(),
});
export const categorySchema = z.object({
  id,
  name: z.string(),
  sortOrder: z.number().int().nonnegative(),
});
export const statusSchema = z.enum(['PENDING', 'COOKING', 'COMPLETED']);
export const orderSchema = z.object({
  id,
  tableNumber: id,
  status: statusSchema,
  totalAmount: z.number(),
  currency: z.literal('KGS'),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
  version: z.number(),
  items: z.array(
    z.object({
      menuItemId: id,
      menuItemName: z.string(),
      quantity: z.number().int(),
      priceAtOrder: z.number(),
      lineTotal: z.number(),
    }),
  ),
});
export const staffSchema = z.object({
  id,
  username: z.string(),
  role: z.enum(['ADMIN', 'KITCHEN']),
});
export const authSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  expiresAt: z.iso.datetime(),
  staff: staffSchema,
});
export const tableSchema = z.object({
  id,
  number: id,
  isActive: z.boolean(),
  qrTokenVersion: z.number().int(),
});
export const qrSchema = z.object({
  url: z.url(),
  tableToken: z.string(),
  tableNumber: id,
  qrTokenVersion: z.number(),
});
export const createOrderSchema = z
  .object({
    tableNumber: id.max(10000),
    tableToken: z.string().min(1).max(256),
    items: z
      .array(
        z
          .object({
            menuItemId: id,
            quantity: z.number().int().min(1).max(100),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict()
  .refine(
    (v) => new Set(v.items.map((i) => i.menuItemId)).size === v.items.length,
    'Повторяющиеся блюда',
  );
export type MenuItem = z.infer<typeof menuItemSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Order = z.infer<typeof orderSchema>;
export type OrderStatus = z.infer<typeof statusSchema>;
export type Staff = z.infer<typeof staffSchema>;
export type AuthSession = z.infer<typeof authSchema>;
export type RestaurantTable = z.infer<typeof tableSchema>;
export type QrMetadata = z.infer<typeof qrSchema>;
export type CreateOrderRequest = z.infer<typeof createOrderSchema>;
export type MenuRequest = Pick<
  MenuItem,
  | 'name'
  | 'description'
  | 'price'
  | 'imageUrl'
  | 'categoryId'
  | 'isAvailable'
  | 'isActive'
>;
export type CategoryRequest = Pick<Category, 'name' | 'sortOrder'>;
const baseEvent = { eventId: z.string(), occurredAt: z.string() };
const menuFields = {
  menuItemId: id,
  isAvailable: z.boolean(),
  isActive: z.boolean(),
  updatedAt: z.string(),
  version: z.number(),
};
export const eventSchema = z.discriminatedUnion('type', [
  z.object({
    ...baseEvent,
    type: z.literal('NEW_ORDER'),
    orderId: id,
    order: orderSchema,
  }),
  z.object({
    ...baseEvent,
    type: z.literal('ORDER_STATUS_CHANGED'),
    orderId: id,
    previousStatus: statusSchema,
    newStatus: statusSchema,
    completedAt: z.string().nullable(),
    version: z.number(),
    order: orderSchema,
  }),
  z.object({ ...baseEvent, ...menuFields, type: z.literal('MENU_CHANGED') }),
  z.object({
    ...baseEvent,
    ...menuFields,
    type: z.literal('MENU_ITEM_AVAILABILITY_CHANGED'),
  }),
  z.object({ ...baseEvent, type: z.literal('CATEGORIES_CHANGED') }),
]);
export type RealtimeEvent = z.infer<typeof eventSchema>;
