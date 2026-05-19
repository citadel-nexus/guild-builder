import { describe, expect, it } from 'vitest';

import { createStripeIntegration } from '../../../../src/agents/datadog-bridge/integrations/stripe.js';
import type { MetricSubmission } from '../../../../src/agents/datadog-bridge/types.js';

describe('createStripeIntegration', () => {
  it('submits payment amount and count metrics', async () => {
    const submissions: MetricSubmission[][] = [];
    const integration = createStripeIntegration({
      inboundSubject: 'citadel.builder.datadog.integration.stripe.payment',
      client: {
        submitMetrics: async (metrics) => {
          submissions.push(metrics);
        },
      },
    });

    await integration.handle({
      eventType: 'checkout.session.completed',
      amount: 199,
      currency: 'USD',
      customerId: 'cus_123',
      plan: 'growth',
      timestamp: '2026-05-18T00:00:00.000Z',
    });

    expect(submissions).toHaveLength(1);
    const metricNames = submissions[0].map((metric) => metric.metric);
    expect(metricNames).toContain('citadel.stripe.payment.amount');
    expect(metricNames).toContain('citadel.stripe.payment.count');
  });
});