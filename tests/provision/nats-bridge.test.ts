import { describe, expect, it } from 'vitest';

import {
  ProvisionNatsBridge,
  ProvisionOrchestrator,
  type NatsLikeClient,
  type NatsLikeMessage,
  type NatsLikeSubscription,
  type Stage,
} from '../../src/provision/index.js';

class FakeSubscription implements NatsLikeSubscription {
  private readonly queue: NatsLikeMessage[] = [];
  private waiter: ((msg: NatsLikeMessage | null) => void) | null = null;
  private closed = false;

  push(msg: NatsLikeMessage): void {
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w(msg);
    } else {
      this.queue.push(msg);
    }
  }

  unsubscribe(): void {
    this.closed = true;
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w(null);
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<NatsLikeMessage> {
    while (true) {
      if (this.queue.length) {
        yield this.queue.shift()!;
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

class FakeNatsClient implements NatsLikeClient {
  readonly published: { subject: string; data: string }[] = [];
  readonly subs = new Map<string, FakeSubscription>();

  subscribe(subject: string): NatsLikeSubscription {
    const sub = new FakeSubscription();
    this.subs.set(subject, sub);
    return sub;
  }

  publish(subject: string, data: Uint8Array): void {
    this.published.push({ subject, data: new TextDecoder().decode(data) });
  }

  emit(subject: string, payload: unknown): void {
    const sub = this.subs.get(subject);
    if (!sub) throw new Error(`no subscription for ${subject}`);
    sub.push({
      subject,
      data: new TextEncoder().encode(JSON.stringify(payload)),
    });
  }
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 1000,
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('timeout waiting for predicate');
    }
    await new Promise((r) => setTimeout(r, 5));
  }
}

const inboundSubject = 'walkin.tenant.provisioned';
const outboundSubjectPrefix = 'tb';

describe('ProvisionNatsBridge', () => {
  it('runs the orchestrator and publishes events on inbound messages', async () => {
    const client = new FakeNatsClient();
    const stages: Stage[] = [
      { name: 'a', run: async () => ({ status: 'ok' }) },
      { name: 'b', run: async () => ({ status: 'ok' }) },
    ];
    const orchestrator = new ProvisionOrchestrator({ stages });
    const bridge = new ProvisionNatsBridge({
      client,
      orchestrator,
      inboundSubject,
      outboundSubjectPrefix,
      logger: { log: () => {}, warn: () => {}, error: () => {} },
    });

    await bridge.start();
    client.emit(inboundSubject, {
      tenantId: 'bcx',
      industry: 'cosmetology',
      tier: 'growth',
    });

    await waitFor(() =>
      client.published.some((p) => p.subject === 'tb.bcx.provision.complete'),
    );
    await bridge.stop();

    const subjects = client.published.map((p) => p.subject);
    expect(subjects).toContain('tb.bcx.provision.started');
    expect(subjects).toContain('tb.bcx.provision.a.started');
    expect(subjects).toContain('tb.bcx.provision.a.done');
    expect(subjects).toContain('tb.bcx.provision.b.done');
    expect(subjects).toContain('tb.bcx.provision.complete');
  });

  it('accepts payloads using snake_case tenant_id', async () => {
    const client = new FakeNatsClient();
    const orchestrator = new ProvisionOrchestrator({
      stages: [{ name: 'a', run: async () => ({ status: 'ok' }) }],
    });
    const bridge = new ProvisionNatsBridge({
      client,
      orchestrator,
      inboundSubject,
      outboundSubjectPrefix,
      logger: { log: () => {}, warn: () => {}, error: () => {} },
    });

    await bridge.start();
    client.emit(inboundSubject, {
      tenant_id: 'snake',
      industry: 'plumbing',
      tier: 'starter',
    });

    await waitFor(() =>
      client.published.some((p) => p.subject === 'tb.snake.provision.complete'),
    );
    await bridge.stop();
  });

  it('logs a parse error and stays alive on malformed payloads', async () => {
    const errors: string[] = [];
    const client = new FakeNatsClient();
    const orchestrator = new ProvisionOrchestrator({
      stages: [{ name: 'a', run: async () => ({ status: 'ok' }) }],
    });
    const bridge = new ProvisionNatsBridge({
      client,
      orchestrator,
      inboundSubject,
      outboundSubjectPrefix,
      logger: {
        log: () => {},
        warn: () => {},
        error: (msg: string) => errors.push(msg),
      },
    });

    await bridge.start();
    // missing tenantId
    client.emit(inboundSubject, { industry: 'x' });
    await waitFor(() => errors.length > 0);

    // bridge still processes valid payloads after a parse error
    client.emit(inboundSubject, {
      tenantId: 'ok',
      industry: 'x',
      tier: 'starter',
    });
    await waitFor(() =>
      client.published.some((p) => p.subject === 'tb.ok.provision.complete'),
    );
    await bridge.stop();
  });

  it('rejects construction without inbound subject or outbound prefix', () => {
    const client = new FakeNatsClient();
    const orchestrator = new ProvisionOrchestrator();

    expect(
      () =>
        new ProvisionNatsBridge({
          client,
          orchestrator,
          inboundSubject: '',
          outboundSubjectPrefix: 'tb',
        }),
    ).toThrow(/inboundSubject/);

    expect(
      () =>
        new ProvisionNatsBridge({
          client,
          orchestrator,
          inboundSubject: 'x',
          outboundSubjectPrefix: '',
        }),
    ).toThrow(/outboundSubjectPrefix/);
  });
});
