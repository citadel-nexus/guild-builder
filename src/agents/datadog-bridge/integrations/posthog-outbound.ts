import type {
  DatadogEvent,
  OutboundPublishResult,
  OutboundPublisher,
  PostHogOutboundConfig,
} from '../types.js';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function normalizeHost(host: string): string {
  return host.endsWith('/') ? host.slice(0, -1) : host;
}

export class PostHogOutboundPublisher implements OutboundPublisher {
  readonly name = 'posthog';
  private readonly config: PostHogOutboundConfig;
  private readonly fetchImpl: FetchLike;

  constructor(config: PostHogOutboundConfig, fetchImpl: FetchLike = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async publish(event: DatadogEvent): Promise<OutboundPublishResult> {
    const host = normalizeHost(this.config.host);
    const distinctId = `${this.config.distinctIdPrefix ?? 'datadog'}:${event.source}`;
    const payload = {
      api_key: this.config.apiKey,
      event: '$datadog_bridge_event',
      distinct_id: distinctId,
      properties: {
        dd_kind: event.kind,
        dd_source: event.source,
        dd_title: event.title,
        dd_detail: event.detail ?? null,
        dd_severity: event.severity,
        dd_timestamp: event.timestamp,
        ...event.tags,
      },
      timestamp: event.timestamp,
    };

    try {
      const response = await this.fetchImpl(`${host}/capture/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text();
        return {
          publisher: this.name,
          ok: false,
          error: `PostHog ${response.status}: ${text || 'request failed'}`,
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
