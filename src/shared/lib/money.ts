export const toTyin = (amount: number): number => Math.round(amount * 100);
export const money = (amount: number): string =>
  `${new Intl.NumberFormat('ru-KG', { maximumFractionDigits: 2 }).format(amount)} сом`;
export function elapsed(createdAt: string, now = Date.now()) {
  return Math.max(0, Math.floor((now - Date.parse(createdAt)) / 1000) || 0);
}
export function elapsedLabel(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
