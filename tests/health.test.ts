import { describe, expect, it } from 'vitest';

import { healthCheck } from '../src/routes/health.js';

describe('healthCheck', () => {
  it('returns the public builder health payload shape', () => {
    const payload = healthCheck();

    expect(payload.guild).toBe('builder');
    expect(payload.status).toBe('healthy');
    expect(payload.nats_prefix).toBe('citadel.builder.*');
    expect(typeof payload.timestamp).toBe('string');
  });
});
