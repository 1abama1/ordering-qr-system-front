import { expect, it } from 'vitest';
import { redactSensitiveUrl } from '../../src/shared/lib/redact';
it('redacts QR credentials from dev proxy error URLs while keeping diagnostic paths', () => {
  expect(
    redactSensitiveUrl(
      'proxy /api/tables/resolve?tableNumber=3&tableToken=test-secret&x=1',
    ),
  ).toBe('proxy /api/tables/resolve?tableNumber=3&tableToken=[redacted]&x=1');
  expect(redactSensitiveUrl('/menu?table=3&token=test-secret')).not.toContain(
    'test-secret',
  );
  expect(redactSensitiveUrl('/api/categories')).toBe('/api/categories');
});
