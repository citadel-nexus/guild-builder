import { readRecord, readString } from '../codec.js';
import type { DatadogBridgeClient } from '../client.js';
import type { Integration, PostHogInboundEvent } from '../types.js';

type PosthogIntegrationOptions = {
  client: Pick<DatadogBridgeClient, 'submitEvent'>;
  inboundSubject: string;
};

function toTagValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '_')
    .replace(/_+/g, '_');
}

function parsePosthogPayload(payload: Record<string, unknown>): PostHogInboundEvent {
  const event = readString(payload.event, 'event');
  const distinctId =
    readString(payload.distinctId, 'distinctId') ??
    readString(payload.distinct_id, 'distinct_id');
  if (!event || !distinctId) {
    throw new Error('event and distinctId are required');
  }

  const properties = payload.properties
    ? readRecord(payload.properties, 'properties')
    : undefined;
  const timestamp = readString(payload.timestamp, 'timestamp');
  return {
    event,
    distinctId,
    properties,
    timestamp,
  };
}

function parseDateSeconds(timestamp: string | undefined): number {
  if (!timestamp) {
    return Math.floor(Date.now() / 1000);
  }
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    return Math.floor(Date.now() / 1000);
  }
  return Math.floor(parsed / 1000);
}

export function createPosthogIntegration(
  options: PosthogIntegrationOptions,
): Integration {
  return {
    name: 'posthog',
    inboundSubject: options.inboundSubject,
    handle: async (payload) => {
      const event = parsePosthogPayload(payload);
      const tags = [
        'source:posthog',
        `event:${toTagValue(event.event)}`,
        `distinct_id:${toTagValue(event.distinctId)}`,
      ];

      if (event.properties) {
        for (const [key, value] of Object.entries(event.properties)) {
          if (typeof value === 'string') {
            tags.push(`${toTagValue(key)}:${toTagValue(value)}`);
          } else if (typeof value === 'number' || typeof value === 'boolean') {
            tags.push(`${toTagValue(key)}:${value}`);
          }
          if (tags.length >= 15) {
            break;
          }
        }
      }

      await options.client.submitEvent({
        title: `posthog:${event.event}`,
        text: JSON.stringify(
          {
            distinctId: event.distinctId,
            properties: event.properties ?? {},
          },
          null,
          2,
        ),
        tags,
        dateHappened: parseDateSeconds(event.timestamp),
      });
    },
  };
}