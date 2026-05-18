import { readNumber, readString } from '../codec.js';
import type { DatadogBridgeClient } from '../client.js';
import type { Integration, StripePaymentEvent } from '../types.js';

type StripeIntegrationOptions = {
  client: Pick<DatadogBridgeClient, 'submitMetrics'>;
  inboundSubject: string;
};

function parseStripePayload(payload: Record<string, unknown>): StripePaymentEvent {
  const eventType =
    readString(payload.eventType, 'eventType') ??
    readString(payload.event_type, 'event_type');
  const amount = readNumber(payload.amount, 'amount');
  const currency = readString(payload.currency, 'currency');
  if (!eventType || amount === undefined || !currency) {
    throw new Error('eventType, amount, and currency are required');
  }

  const customerId =
    readString(payload.customerId, 'customerId') ??
    readString(payload.customer_id, 'customer_id');
  const plan = readString(payload.plan, 'plan');
  const timestamp =
    readString(payload.timestamp, 'timestamp') ?? new Date().toISOString();

  return {
    eventType,
    amount,
    currency,
    customerId,
    plan,
    timestamp,
  };
}

export function createStripeIntegration(
  options: StripeIntegrationOptions,
): Integration {
  return {
    name: 'stripe',
    inboundSubject: options.inboundSubject,
    handle: async (payload) => {
      const event = parseStripePayload(payload);
      const eventTimestamp = Math.floor(Date.parse(event.timestamp) / 1000);
      const timestamp = Number.isNaN(eventTimestamp)
        ? Math.floor(Date.now() / 1000)
        : eventTimestamp;

      const tags = [
        'source:stripe',
        `event_type:${event.eventType}`,
        `currency:${event.currency.toLowerCase()}`,
      ];
      if (event.plan) {
        tags.push(`plan:${event.plan}`);
      }
      if (event.customerId) {
        tags.push(`customer_id:${event.customerId}`);
      }

      await options.client.submitMetrics([
        {
          metric: 'citadel.stripe.payment.amount',
          type: 'gauge',
          points: [{ timestamp, value: event.amount }],
          tags,
        },
        {
          metric: 'citadel.stripe.payment.count',
          type: 'count',
          points: [{ timestamp, value: 1 }],
          tags,
        },
      ]);
    },
  };
}