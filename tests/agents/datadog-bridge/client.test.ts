import { describe, expect, it } from 'vitest';

import { DatadogApiClient } from '../../../src/agents/datadog-bridge/client.js';

type FetchCall = {
  input: string;
  init?: RequestInit;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function createClient(
  responder: (call: FetchCall) => Promise<Response>,
): {
  client: DatadogApiClient;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const fetchImpl = async (input: string, init?: RequestInit): Promise<Response> => {
    const call: FetchCall = { input, init };
    calls.push(call);
    return responder(call);
  };

  const client = new DatadogApiClient({
    config: {
      apiKey: 'test-api',
      appKey: 'test-app',
      site: 'us5.datadoghq.com',
      natsUrl: 'nats://localhost:4222',
      subjectPrefix: 'citadel.builder.datadog',
      pollIntervalMs: 60000,
    },
    fetchImpl,
  });

  return { client, calls };
}

describe('DatadogApiClient', () => {
  it('builds monitor status requests with Datadog auth headers', async () => {
    const { client, calls } = createClient(async () =>
      jsonResponse([
        {
          id: 18183033,
          name: 'NATS Publisher Not Connecting',
          overall_state: 'Alert',
          message: 'monitor in alert',
          tags: ['env:prod'],
        },
      ]),
    );

    const result = await client.fetchMonitorStatuses();

    expect(calls).toHaveLength(1);
    const request = calls[0];
    const url = new URL(request.input);
    expect(url.pathname).toBe('/api/v1/monitor');
    expect(url.searchParams.get('group_states')).toBe('alert,warn,no_data,ok');

    const headers = new Headers(request.init?.headers);
    expect(headers.get('DD-API-KEY')).toBe('test-api');
    expect(headers.get('DD-APPLICATION-KEY')).toBe('test-app');
    expect(headers.get('Content-Type')).toBe('application/json');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(18183033);
      expect(result.data[0].overallState).toBe('Alert');
    }
  });

  it('encodes metric query params in the v1 query endpoint', async () => {
    const { client, calls } = createClient(async () =>
      jsonResponse({
        from: 1716000000,
        to: 1716000300,
        query: 'avg:system.cpu.user{env:prod}',
        series: [
          {
            metric: 'system.cpu.user',
            pointlist: [
              [1716000000, 10],
              [1716000060, 12],
            ],
            tag_set: ['env:prod'],
          },
        ],
      }),
    );

    const result = await client.queryMetric(
      'avg:system.cpu.user{env:prod}',
      1716000000,
      1716000300,
    );

    expect(calls).toHaveLength(1);
    const request = calls[0];
    const url = new URL(request.input);
    expect(url.pathname).toBe('/api/v1/query');
    expect(url.searchParams.get('query')).toBe('avg:system.cpu.user{env:prod}');
    expect(url.searchParams.get('from')).toBe('1716000000');
    expect(url.searchParams.get('to')).toBe('1716000300');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.series).toHaveLength(1);
      expect(result.data.series[0].points).toHaveLength(2);
    }
  });

  it('uses POST with JSON body for logs search requests', async () => {
    const { client, calls } = createClient(async () =>
      jsonResponse({
        data: [
          {
            id: 'abc',
            attributes: {
              timestamp: '2026-05-18T12:00:00.000Z',
              message: 'error happened',
              service: 'api-service',
              status: 'error',
              tags: ['env:prod'],
            },
          },
        ],
      }),
    );

    const result = await client.searchLogs(
      'service:api-service status:error',
      'now-15m',
      'now',
    );

    expect(calls).toHaveLength(1);
    const request = calls[0];
    const url = new URL(request.input);
    expect(url.pathname).toBe('/api/v2/logs/events/search');
    expect(request.init?.method).toBe('POST');

    expect(typeof request.init?.body).toBe('string');
    const bodyText = typeof request.init?.body === 'string' ? request.init.body : '';
    const parsedBody = JSON.parse(bodyText);
    expect(isRecord(parsedBody)).toBe(true);
    if (!isRecord(parsedBody)) {
      throw new Error('expected request body to be an object');
    }
    const filter = parsedBody.filter;
    expect(isRecord(filter)).toBe(true);
    if (!isRecord(filter)) {
      throw new Error('expected request body filter to be an object');
    }
    expect(filter.query).toBe('service:api-service status:error');
    expect(filter.from).toBe('now-15m');
    expect(filter.to).toBe('now');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.events).toHaveLength(1);
      expect(result.data.events[0].id).toBe('abc');
    }
  });
});