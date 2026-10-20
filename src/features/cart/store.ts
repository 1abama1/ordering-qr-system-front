import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { z } from '../../shared/config/validation';
import type { MenuItem } from '../../shared/api/contracts';
import { toTyin } from '../../shared/lib/money';
export type CartLine = { menuItemId: number; quantity: number };
export const cartLinesSchema = z
  .array(
    z.object({
      menuItemId: z.number().int().positive(),
      quantity: z.number().int().min(1).max(100),
    }),
  )
  .max(50)
  .refine(
    (lines) => new Set(lines.map((l) => l.menuItemId)).size === lines.length,
  );
export function changeQuantity(
  lines: CartLine[],
  item: Pick<MenuItem, 'id' | 'isAvailable' | 'isActive'>,
  delta: number,
): CartLine[] {
  const current = lines.find((l) => l.menuItemId === item.id);
  if (delta > 0 && (!item.isAvailable || !item.isActive)) return lines;
  const next = (current?.quantity ?? 0) + delta;
  if (next <= 0) return lines.filter((l) => l.menuItemId !== item.id);
  if (next > 100 || (!current && lines.length >= 50)) return lines;
  return current
    ? lines.map((l) =>
        l.menuItemId === item.id ? { ...l, quantity: next } : l,
      )
    : [...lines, { menuItemId: item.id, quantity: next }];
}
export function cartTotal(lines: CartLine[], menu: MenuItem[]) {
  return lines.reduce(
    (sum, l) =>
      sum +
      toTyin(menu.find((m) => m.id === l.menuItemId)?.price ?? 0) * l.quantity,
    0,
  );
}
interface CartStore {
  lines: CartLine[];
  tableNumber: number | null;
  bindTable: (number: number) => void;
  change: (item: MenuItem, delta: number) => void;
  remove: (id: number) => void;
  clear: () => void;
}
export const useCart = create<CartStore>()(
  persist(
    (set) => ({
      lines: [],
      tableNumber: null,
      bindTable: (number) =>
        set((s) =>
          s.tableNumber === number ? s : { tableNumber: number, lines: [] },
        ),
      change: (item, delta) =>
        set((s) => ({ lines: changeQuantity(s.lines, item, delta) })),
      remove: (id) =>
        set((s) => ({ lines: s.lines.filter((l) => l.menuItemId !== id) })),
      clear: () => set({ lines: [] }),
    }),
    {
      name: 'restaurant.cart.v1',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ lines: s.lines, tableNumber: s.tableNumber }),
      merge: (persisted, current) => {
        const p = z
          .object({
            lines: cartLinesSchema,
            tableNumber: z.number().int().positive().nullable(),
          })
          .safeParse(persisted);
        return p.success ? { ...current, ...p.data } : current;
      },
    },
  ),
);
