import { describe, expect, it } from 'vitest';

import { DatadogMonitorWatcher } from '../../../src/agents/datadog-bridge/monitor-watcher.js';
import type {
  DatadogApiResult,
  DatadogMonitorSummary,
} from '../../../src/agents/datadog-bridge/types.js';

type PublishedMessage = {
  subject: string;
  payload: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodePayload(data: Uint8Array): Record<string, unknown> {
  const parsed = JSON.parse(new TextDecoder().decode(data));
  if (isRecord(parsed)) {
    return parsed;
  }
  throw new Error('payload is not an object');
}

class FakeNatsPublisher {
  readonly published: PublishedMessage[] = [];

  publish(subject: string, data: Uint8Array): void {
    this.published.push({
      subject,
      payload: decodePayload(data),
    });
  }
}

class FakeMonitorClient {
  private readonly responses: DatadogApiResult<DatadogMonitorSummary[]>[];

  constructor(responses: DatadogApiResult<DatadogMonitorSummary[]>) {
    this.responses = [responses];
  }

  push(response: DatadogApiResult<DatadogMonitorSummary[]>): void {
    this.responses.push(response);
  }

  async fetchMonitorStatuses(): Promise<DatadogApiResult<DatadogMonitorSummary[]>> {
    const next = this.responses.shift();
    if (!next) {
      throw new Error('no monitor response queued');
    }
    return next;
  }
}

function okMonitors(
  monitors: DatadogMonitorSummary[],
): DatadogApiResult<DatadogMonitorSummary[]> {
  return {
    ok: true,
    statusCode: 200,
    data: monitors,
  };
}

describe('DatadogMonitorWatcher', () => {
  it('publishes monitor transition events and cycle heartbeats', async () => {
    const prefix = 'citadel.builder.datadog';
    const client = new FakeMonitorClient(
      okMonitors([
        {
          id: 42,
          name: 'CPU usage high',
          overallState: 'OK',
          tags: ['env:prod'],
          raw: {},
        },
      ]),
    );
    client.push(
      okMonitors([
        {
          id: 42,
          name: 'CPU usage high',
          overallState: 'OK',
          tags: ['env:prod'],
          raw: {},
        },
      ]),
    );
    client.push(
      okMonitors([
        {
          id: 42,
          name: 'CPU usage high',
          overallState: 'Alert',
          tags: ['env:prod'],
          raw: {},
        },
      ]),
    );

    const nats = new FakeNatsPublisher();
    const watcher = new DatadogMonitorWatcher({
      client,
      natsClient: nats,
      subjectPrefix: prefix,
      pollIntervalMs: 60000,
      nowMs: () => Date.UTC(2026, 4, 18, 12, 0, 0),
      logger: { warn: () => {}, error: () => {} },
    });

    await watcher.pollOnce();
    await watcher.pollOnce();
    await watcher.pollOnce();

    const monitorSubjects = nats.published
      .filter((entry) => entry.subject.includes('.monitor.'))
      .map((entry) => entry.subject);
    expect(monitorSubjects).toEqual([
      `${prefix}.monitor.ok`,
      `${prefix}.monitor.alert`,
    ]);

    const heartbeatEvents = nats.published.filter(
      (entry) => entry.subject === `${prefix}.heartbeat`,
    );
    expect(heartbeatEvents).toHaveLength(3);
  });

  it('publishes warning heartbeat when polling Datadog fails', async () => {
    const nats = new FakeNatsPublisher();
    const client = new FakeMonitorClient({
      ok: false,
      statusCode: 500,
      error: 'upstream failure',
    });
    const watcher = new DatadogMonitorWatcher({
      client,
      natsClient: nats,
      subjectPrefix: 'citadel.builder.datadog',
      pollIntervalMs: 60000,
      nowMs: () => Date.UTC(2026, 4, 18, 12, 10, 0),
      logger: { warn: () => {}, error: () => {} },
    });

    await watcher.pollOnce();

    expect(nats.published).toHaveLength(1);
    expect(nats.published[0].subject).toBe('citadel.builder.datadog.heartbeat');
    expect(nats.published[0].payload.kind).toBe('agent.heartbeat');
    expect(nats.published[0].payload.severity).toBe('warning');
  });
});