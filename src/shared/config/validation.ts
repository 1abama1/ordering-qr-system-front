import { z } from 'zod';

// Configure before App imports create schemas: strict CSP also blocks JIT probes.
z.config({ jitless: true });
export { z };
