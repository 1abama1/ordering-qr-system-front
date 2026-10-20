export function readStorage(key: string): unknown {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function writeStorage(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error(
      'Разрешите хранение данных в этой вкладке для безопасного оформления заказа.',
    );
  }
}
