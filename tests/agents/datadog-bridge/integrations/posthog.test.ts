import { describe, expect, it } from 'vitest';

import { createPosthogIntegration } from '../../../../src/agents/datadog-bridge/integrations/posthog.js';
import type { DatadogEventSubmission } from '../../../../src/agents/datadog-bridge/types.js';

describe('createPosthogIntegration', () => {
  it('maps a PostHog event into a Datadog event submission', async () => {
    const submitted: DatadogEventSubmission[] = [];
    const integration = createPosthogIntegration({
      inboundSubject: 'citadel.builder.datadog.integration.posthog.event',
      client: {
        submitEvent: async (event) => {
          submitted.push(event);
        },
      },
    });

    await integration.handle({
      event: 'cta_clicked',
      distinctId: 'person-1',
      properties: {
        plan: 'growth',
      },
      timestamp: '2026-05-18T00:00:00.000Z',
    });

    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toMatchObject({
      title: 'posthog:cta_clicked',
    });
  });
});