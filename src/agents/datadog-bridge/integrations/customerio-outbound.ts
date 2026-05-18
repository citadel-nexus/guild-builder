import { Buffer } from 'node:buffer';

import type {
  CustomerIoOutboundConfig,
  DatadogEvent,
  OutboundPublishResult,
  OutboundPublisher,
} from '../types.js';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function trackEndpoint(region: 'us' | 'eu'): string {
  return region === 'eu'
    ? 'https://track-eu.customer.io/api/v1/customers'
    : 'https://track.customer.io/api/v1/customers';
}

export class CustomerIoOutboundPublisher implements OutboundPublisher {
  readonly name = 'customerio';
  private readonly config: CustomerIoOutboundConfig;
  private readonly fetchImpl: FetchLike;

  constructor(config: CustomerIoOutboundConfig, fetchImpl: FetchLike = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async publish(event: DatadogEvent): Promise<OutboundPublishResult> {
    const customerId = `datadog:${event.source}`;
    const body = {
      name: '$datadog_bridge_event',
      data: {
        title: event.title,
        detail: event.detail ?? null,
        severity: event.severity,
        kind: event.kind,
        timestamp: event.timestamp,
        tags: event.tags,
      },
      timestamp: event.timestamp,
    };

    try {
      const response = await this.fetchImpl(`${trackEndpoint(this.config.region)}/${encodeURIComponent(customerId)}/events`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.config.siteId}:${this.config.trackApiKey}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await response.text();
        return {
          publisher: this.name,
          ok: false,
          error: `Customer.io ${response.status}: ${text || 'request failed'}`,
        };
      }
      return {
        publisher: this.name,
        ok: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        publisher: this.name,
        ok: false,
        error: message,
      };
    }
  }
}
