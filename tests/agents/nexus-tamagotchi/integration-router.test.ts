import { describe, expect, it } from 'vitest';

import {
  CitadelIntegrationRouter,
  type IntegrationPolicyMatrix,
} from '../../../src/agents/nexus-tamagotchi/integration-router.js';

describe('CitadelIntegrationRouter', () => {
  it('reports service availability based on configured tokens', () => {
    const router = new CitadelIntegrationRouter({
      DD_API_KEY: 'test-key',
    });

    expect(router.isAvailable('datadog')).toBe(true);
    expect(router.isAvailable('slack')).toBe(false);
    expect(router.isAvailable('unknown')).toBe(false);
  });

  it('returns unsupported error for unknown services', async () => {
    const router = new CitadelIntegrationRouter();
    const result = await router.route('unknown-service', 'ping', {});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not supported/i);
  });

  it('returns configuration error when token is missing', async () => {
    const router = new CitadelIntegrationRouter();
    const result = await router.route('slack', 'post_message', {});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/missing token/i);
  });

  it('enforces policy denial before dispatch', async () => {
    const router = new CitadelIntegrationRouter({
      DD_API_KEY: 'test-key',
    });
    const policyMatrix: IntegrationPolicyMatrix = {
      authorize: () => ({
        decision: 'deny',
        reason: 'blocked by policy',
      }),
    };
    router.setPolicyContext({ policyMatrix });

    const result = await router.route('datadog', 'post_metric', {
      user_id: 'operator',
    });

    expect(result.success).toBe(false);
    expect(result.policyDecision).toBe('deny');
    expect(result.error).toMatch(/Policy denied/i);
  });

  it('tracks request statistics for successful dispatches', async () => {
    const router = new CitadelIntegrationRouter({
      DD_API_KEY: 'test-key',
    });
    const result = await router.route('datadog', 'emit_event', {
      user_id: 'system',
      value: 1,
    });
    expect(result.success).toBe(true);

    const stats = router.getStats();
    expect(stats.totalRequests).toBe(1);
    expect(stats.requestCounts.datadog).toBe(1);
    expect(stats.totalErrors).toBe(0);
  });
});