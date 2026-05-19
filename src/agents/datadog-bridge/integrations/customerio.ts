import { readNumber, readString } from '../codec.js';
import type { DatadogBridgeClient } from '../client.js';
import type { CustomerIoWebhook, Integration } from '../types.js';

type CustomerIoIntegrationOptions = {
  client: Pick<DatadogBridgeClient, 'submitLogs'>;
  inboundSubject: string;
};

function parseCustomerIoPayload(
  payload: Record<string, unknown>,
): CustomerIoWebhook {
  const eventType =
    readString(payload.event_type, 'event_type') ??
    readString(payload.eventType, 'eventType');
  const timestamp = readNumber(payload.timestamp, 'timestamp');
  if (!eventType || timestamp === undefined) {
    throw new Error('event_type and timestamp are required');
  }

  const campaignId = readNumber(payload.campaign_id, 'campaign_id');
  const customerId = readString(payload.customer_id, 'customer_id');
  const templateId = readNumber(payload.template_id, 'template_id');

  return {
    event_type: eventType,
    timestamp,
    campaign_id: campaignId,
    customer_id: customerId,
    template_id: templateId,
  };
}

export function createCustomerIoIntegration(
  options: CustomerIoIntegrationOptions,
): Integration {
  return {
    name: 'customerio',
    inboundSubject: options.inboundSubject,
    handle: async (payload) => {
      const event = parseCustomerIoPayload(payload);
      const tags: string[] = [
        'source:customerio',
        `event_type:${event.event_type}`,
      ];
      if (event.campaign_id !== undefined) {
        tags.push(`campaign_id:${event.campaign_id}`);
      }
      if (event.customer_id) {
        tags.push(`customer_id:${event.customer_id}`);
      }

      await options.client.submitLogs([
        {
          message: `customer.io ${event.event_type}`,
          service: 'customerio',
          ddsource: 'customerio',
          ddtags: tags.join(','),
          timestamp: new Date(event.timestamp * 1000).toISOString(),
          attributes: {
            campaign_id: event.campaign_id,
            customer_id: event.customer_id,
            template_id: event.template_id,
          },
        },
      ]);
    },
  };
}