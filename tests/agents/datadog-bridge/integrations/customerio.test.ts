import { describe, expect, it } from 'vitest';

import { createCustomerIoIntegration } from '../../../../src/agents/datadog-bridge/integrations/customerio.js';
import type { LogEntry } from '../../../../src/agents/datadog-bridge/types.js';

describe('createCustomerIoIntegration', () => {
  it('maps customer.io webhook payloads to Datadog logs', async () => {
    const logs: LogEntry[][] = [];
    const integration = createCustomerIoIntegration({
      inboundSubject: 'citadel.builder.datadog.integration.customerio.webhook',
      client: {
        submitLogs: async (entries) => {
          logs.push(entries);
        },
      },
    });

    await integration.handle({
      event_type: 'delivered',
      campaign_id: 101,
      customer_id: 'customer-1',
      timestamp: 1_710_000_000,
    });

    expect(logs).toHaveLength(1);
    expect(logs[0][0]).toMatchObject({
      service: 'customerio',
      ddsource: 'customerio',
    });
  });
});