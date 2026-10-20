const apiUrl = import.meta.env.VITE_API_URL?.trim() ?? '';
const explicitWs = import.meta.env.VITE_WS_URL?.trim() || '';
const wsUrl =
  explicitWs ||
  `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
const broker = new URL(wsUrl);
if (broker.search || broker.hash || broker.username || broker.password)
  throw new Error(
    'WebSocket URL must not contain credentials or query parameters',
  );
if (import.meta.env.PROD) {
  for (const [value, protocol] of [
    [apiUrl, 'https:'],
    [explicitWs, 'wss:'],
  ]) {
    if (!value) continue;
    const url = new URL(value);
    if (
      url.protocol !== protocol ||
      /^(localhost|127\..*|\[::1\])$/.test(url.hostname)
    )
      throw new Error(
        'Production must use same-origin or public HTTPS/WSS URLs',
      );
  }
}
export const env = {
  apiUrl,
  wsUrl,
  restaurant: import.meta.env.VITE_RESTAURANT_NAME || 'DASTOR',
};
