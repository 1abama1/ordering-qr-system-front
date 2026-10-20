import { expect, it, vi } from 'vitest';
import { secureUuid } from '../../src/shared/lib/uuid';
it('prefers native crypto.randomUUID in secure contexts', () => {
  const randomUUID = vi.fn(() => 'native-uuid');
  expect(
    secureUuid({
      randomUUID,
      getRandomValues: crypto.getRandomValues.bind(crypto),
    }),
  ).toBe('native-uuid');
  expect(randomUUID).toHaveBeenCalledOnce();
});
it('uses cryptographic random bytes with UUID v4/version and variant for HTTP LAN', () => {
  const uuid = secureUuid({
    getRandomValues: (bytes) => {
      bytes.fill(255);
      return bytes;
    },
  });
  expect(uuid).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  expect(
    secureUuid({ getRandomValues: crypto.getRandomValues.bind(crypto) }),
  ).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});
