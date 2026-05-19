import { describe, expect, it } from 'vitest';

import { AutomationEngine } from '../../../src/agents/datadog-bridge/automation-engine.js';
import { buildDatadogBridgeSubjects } from '../../../src/agents/datadog-bridge/subjects.js';
import type {
  NatsLikeConnection,
  NatsLikeMessage,
  NatsLikeSubscription,
} from '../../../src/agents/datadog-bridge/types.js';

class FakeSubscription implements NatsLikeSubscription {
  private readonly queue: NatsLikeMessage[] = [];
  private waiter: ((value: NatsLikeMessage | null) => void) | null = null;
  private closed = false;

  push(message: NatsLikeMessage): void {
    if (this.waiter) {
      const resolver = this.waiter;
      this.waiter = null;
      resolver(message);
      return;
    }
    this.queue.push(message);
  }

  unsubscribe(): void {
    this.closed = true;
    if (this.waiter) {
      const resolver = this.waiter;
      this.waiter = null;
      resolver(null);
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<NatsLikeMessage> {
    while (true) {
      if (this.queue.length > 0) {
        const message = this.queue.shift();
        if (message) {
          yield message;
        }
        continue;
      }
      if (this.closed) {
        return;
      }
      const next = await new Promise<NatsLikeMessage | null>((resolve) => {
        this.waiter = resolve;
      });
      if (next === null) {
        return;
      }
      yield next;
    }
  }
}

class FakeNats implements NatsLikeConnection {
  readonly published: Array<{ subject: string; data: unknown }> = [];
  private readonly subscriptions = new Map<string, FakeSubscription>();

  publish(subject: string, data: Uint8Array): void {
    this.published.push({
      subject,
      data: JSON.parse(new TextDecoder().decode(data)),
    });
  }

  subscribe(subject: string): NatsLikeSubscription {
    const sub = new FakeSubscription();
    this.subscriptions.set(subject, sub);
    return sub;
  }

  emit(subject: string, payload: Record<string, unknown>): void {
    const sub = this.subscriptions.get(subject);
    if (!sub) {
      throw new Error(`missing subscription: ${subject}`);
    }
    sub.push({
      subject,
      data: new TextEncoder().encode(JSON.stringify(payload)),
    });
  }
}

async function waitFor(condition: () => boolean, timeoutMs = 1_000): Promise<void> {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started >= timeoutMs) {
      throw new Error('timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe('AutomationEngine', () => {
  it('executes mute commands and publishes a success result', async () => {
    const nats = new FakeNats();
    const calls: number[] = [];
    const subjects = buildDatadogBridgeSubjects('citadel.builder.datadog');
    const engine = new AutomationEngine({
      nats,
      subjects,
      client: {
        muteMonitor: async (id) => {
          calls.push(id);
        },
        createMonitor: async () => ({
          id: 1,
          name: 'monitor',
          type: 'query alert',
          query: 'avg:test.metric{*} > 0',
        }),
        createDowntime: async () => ({
          id: 'd-1',
          scope: '*',
          startTs: 0,
          endTs: 1,
        }),
        snapshotDashboard: async () => ({ snapshotUrl: 'snapshot' }),
      },
      logger: { log: () => {}, warn: () => {}, error: () => {} },
    });

    await engine.start();
    nats.emit(subjects.automationMute, {
      requestId: 'req-1',
      monitorId: 42,
    });

    await waitFor(() =>
      nats.published.some(
        (event) =>
          event.subject === `${subjects.automationResultPrefix}.req-1` &&
          typeof event.data === 'object',
      ),
    );
    await engine.stop();

    expect(calls).toEqual([42]);
    const result = nats.published.find(
      (entry) => entry.subject === `${subjects.automationResultPrefix}.req-1`,
    );
    expect(result).toBeDefined();
    expect(result?.data).toMatchObject({ ok: true, action: 'automation.mute' });
  });

  it('publishes a failed result for invalid payloads', async () => {
    const nats = new FakeNats();
    const subjects = buildDatadogBridgeSubjects('citadel.builder.datadog');
    const engine = new AutomationEngine({
      nats,
      subjects,
      client: {
        muteMonitor: async () => {},
        createMonitor: async () => ({
          id: 1,
          name: 'monitor',
          type: 'query alert',
          query: 'avg:test.metric{*} > 0',
        }),
        createDowntime: async () => ({
          id: 'd-1',
          scope: '*',
          startTs: 0,
          endTs: 1,
        }),
        snapshotDashboard: async () => ({ snapshotUrl: 'snapshot' }),
      },
      logger: { log: () => {}, warn: () => {}, error: () => {} },
    });

    await engine.start();
    nats.emit(subjects.automationMute, {
      requestId: 'req-2',
    });
    await waitFor(() =>
      nats.published.some(
        (event) => event.subject === `${subjects.automationResultPrefix}.req-2`,
      ),
    );
    await engine.stop();

    const result = nats.published.find(
      (entry) => entry.subject === `${subjects.automationResultPrefix}.req-2`,
    );
    expect(result).toBeDefined();
    expect(result?.data).toMatchObject({ ok: false, action: 'automation.mute' });
  });
});