import { describe, expect, it, vi } from 'vitest';

import { DatadogCommandHandler } from '../../../src/agents/datadog-bridge/command-handler.js';
import type {
  DatadogApiResult,
  DatadogBridgeClient,
  DatadogHostsData,
  DatadogMetricQueryData,
  DatadogMonitorSummary,
  DatadogNatsClient,
  DatadogNatsMessage,
  DatadogNatsSubscription,
  DatadogServiceDefinitionsData,
} from '../../../src/agents/datadog-bridge/types.js';

class FakeSubscription implements DatadogNatsSubscription {
  private readonly queue: DatadogNatsMessage[] = [];
  private waiter: ((value: DatadogNatsMessage | null) => void) | null = null;
  private closed = false;

  push(message: DatadogNatsMessage): void {
    if (this.waiter) {
      const pending = this.waiter;
      this.waiter = null;
      pending(message);
      return;
    }
    this.queue.push(message);
  }

  unsubscribe(): void {
    this.closed = true;
    if (this.waiter) {
      const pending = this.waiter;
      this.waiter = null;
      pending(null);
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<DatadogNatsMessage> {
    while (true) {
      const next = this.queue.shift();
      if (next) {
        yield next;
        continue;
      }
      if (this.closed) {
        return;
      }
      const waited = await new Promise<DatadogNatsMessage | null>((resolve) => {
        this.waiter = resolve;
      });
      if (waited === null) {
        return;
      }
      yield waited;
    }
  }
}

type PublishedResult = {
  subject: string;
  payload: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class FakeNatsClient implements DatadogNatsClient {
  readonly published: PublishedResult[] = [];
  readonly subs = new Map<string, FakeSubscription>();

  subscribe(subject: string): DatadogNatsSubscription {
    const subscription = new FakeSubscription();
    this.subs.set(subject, subscription);
    return subscription;
  }

  publish(subject: string, data: Uint8Array): void {
    const parsed = JSON.parse(new TextDecoder().decode(data));
    if (!isRecord(parsed)) {
      throw new Error('published payload is not an object');
    }
    this.published.push({
      subject,
      payload: parsed,
    });
  }

  emit(subject: string, payload: unknown, reply?: string): void {
    const subscription = this.subs.get(subject);
    if (!subscription) {
      throw new Error(`no subscription for ${subject}`);
    }
    subscription.push({
      subject,
      data: new TextEncoder().encode(JSON.stringify(payload)),
      reply,
    });
  }
}

function ok<T>(data: T): DatadogApiResult<T> {
  return {
    ok: true,
    statusCode: 200,
    data,
  };
}

function waitFor(
  predicate: () => boolean,
  timeoutMs = 1000,
): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error('timeout waiting for predicate'));
        return;
      }
      setTimeout(tick, 5);
    };
    tick();
  });
}

function createClient(): DatadogBridgeClient {
  const monitor: DatadogMonitorSummary = {
    id: 1,
    name: 'test monitor',
    overallState: 'OK',
    tags: [],
    raw: {},
  };
  const metricData: DatadogMetricQueryData = {
    from: 100,
    to: 200,
    query: 'avg:system.cpu.user{*}',
    series: [],
    raw: {},
  };
  const hostsData: DatadogHostsData = {
    hosts: [],
    raw: {},
  };
  const servicesData: DatadogServiceDefinitionsData = {
    services: [
      {
        id: 'svc-1',
        name: 'api-service',
        languages: ['python'],
        raw: {},
      },
    ],
    raw: {},
  };

  return {
    fetchMonitorStatuses: vi.fn(async () => ok([monitor])),
    queryMetric: vi.fn(async (query: string, from: number, to: number) =>
      ok({
        ...metricData,
        query,
        from,
        to,
      }),
    ),
    searchLogs: vi.fn(async () => ok({ events: [], raw: {} })),
    listHosts: vi.fn(async () => ok(hostsData)),
    getMonitor: vi.fn(async () => ok(monitor)),
    createMonitor: vi.fn(async () => ok(monitor)),
    muteMonitor: vi.fn(async () => ok(monitor)),
    snapshotDashboard: vi.fn(async (id: string) => ok({ id, raw: {} })),
    listServices: vi.fn(async () => ok(servicesData)),
  };
}

describe('DatadogCommandHandler', () => {
  it('routes query.monitors and publishes to default result subject', async () => {
    const subjectPrefix = 'citadel.builder.datadog';
    const nats = new FakeNatsClient();
    const client = createClient();
    const handler = new DatadogCommandHandler({
      client,
      natsClient: nats,
      subjectPrefix,
      logger: { warn: () => {}, error: () => {} },
      nowMs: () => 1716000000000,
    });

    await handler.start();
    nats.emit(`${subjectPrefix}.command.query`, {
      action: 'query.monitors',
      requestId: 'req-1',
      params: {},
    });

    await waitFor(() =>
      nats.published.some((entry) => entry.subject === `${subjectPrefix}.result.req-1`),
    );
    await handler.stop();

    const published = nats.published.find(
      (entry) => entry.subject === `${subjectPrefix}.result.req-1`,
    );
    expect(published).toBeDefined();
    expect(published?.payload.status).toBe('ok');
  });

  it('uses replySubject and passes metric parameters to client.queryMetric', async () => {
    const subjectPrefix = 'citadel.builder.datadog';
    const nats = new FakeNatsClient();
    const client = createClient();
    const handler = new DatadogCommandHandler({
      client,
      natsClient: nats,
      subjectPrefix,
      logger: { warn: () => {}, error: () => {} },
      nowMs: () => 1716000000000,
    });

    await handler.start();
    nats.emit(`${subjectPrefix}.command.query`, {
      action: 'query.metric',
      requestId: 'req-2',
      replySubject: 'custom.reply',
      params: {
        query: 'avg:system.mem.pct_usable{*}',
        from: 1716000000,
        to: 1716000300,
      },
    });

    await waitFor(() =>
      nats.published.some((entry) => entry.subject === 'custom.reply'),
    );
    await handler.stop();

    expect(nats.published.some((entry) => entry.subject === 'custom.reply')).toBe(
      true,
    );
    expect(client.queryMetric).toHaveBeenCalledWith(
      'avg:system.mem.pct_usable{*}',
      1716000000,
      1716000300,
    );
  });

  it('returns parse errors when command payload is invalid', async () => {
    const subjectPrefix = 'citadel.builder.datadog';
    const nats = new FakeNatsClient();
    const client = createClient();
    const handler = new DatadogCommandHandler({
      client,
      natsClient: nats,
      subjectPrefix,
      logger: { warn: () => {}, error: () => {} },
      nowMs: () => 1716000000000,
    });

    await handler.start();
    nats.emit(
      `${subjectPrefix}.command.query`,
      {
        action: 'query.metric',
        params: { query: 'avg:system.cpu.user{*}' },
      },
      'reply.inbox',
    );

    await waitFor(() =>
      nats.published.some((entry) => entry.subject === 'reply.inbox'),
    );
    await handler.stop();

    const published = nats.published.find((entry) => entry.subject === 'reply.inbox');
    expect(published?.payload.status).toBe('error');
    expect(String(published?.payload.error)).toMatch(/requestId/);
  });
});