import { describe, expect, it } from 'vitest';

import {
  ResearchSignalPipe,
  defaultResearchSubjectFormatter,
  type ResearchPipeMessage,
  type ResearchPipeNatsClient,
  type ResearchPipeSubscription,
} from '../../src/automation/research-pipe.js';

class FakeSubscription implements ResearchPipeSubscription {
  private readonly queue: ResearchPipeMessage[] = [];
  private waiter: ((message: ResearchPipeMessage | null) => void) | null = null;
  private closed = false;

  push(message: ResearchPipeMessage): void {
    if (this.waiter) {
      const waiting = this.waiter;
      this.waiter = null;
      waiting(message);
      return;
    }
    this.queue.push(message);
  }

  unsubscribe(): void {
    this.closed = true;
    if (!this.waiter) {
      return;
    }
    const waiting = this.waiter;
    this.waiter = null;
    waiting(null);
  }

  async *[Symbol.asyncIterator](): AsyncIterator<ResearchPipeMessage> {
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

      const next = await new Promise<ResearchPipeMessage | null>((resolve) => {
        this.waiter = resolve;
      });
      if (next === null) {
        return;
      }
      yield next;
    }
  }
}

class FakeNatsClient implements ResearchPipeNatsClient {
  readonly published: Array<{ subject: string; data: string }> = [];
  readonly subscriptions = new Map<string, FakeSubscription>();

  subscribe(subject: string): ResearchPipeSubscription {
    const subscription = new FakeSubscription();
    this.subscriptions.set(subject, subscription);
    return subscription;
  }

  publish(subject: string, data: Uint8Array): void {
    this.published.push({ subject, data: new TextDecoder().decode(data) });
  }

  emit(subject: string, payload: unknown): void {
    const subscription = this.subscriptions.get(subject);
    if (!subscription) {
      throw new Error(`no subscription for ${subject}`);
    }
    subscription.push({
      subject,
      data: new TextEncoder().encode(JSON.stringify(payload)),
    });
  }

  emitRaw(subject: string, encodedPayload: string): void {
    const subscription = this.subscriptions.get(subject);
    if (!subscription) {
      throw new Error(`no subscription for ${subject}`);
    }
    subscription.push({
      subject,
      data: new TextEncoder().encode(encodedPayload),
    });
  }
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 1000,
): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('timeout waiting for expected condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe('defaultResearchSubjectFormatter', () => {
  it('normalizes event, namespace and target guild segments', () => {
    expect(
      defaultResearchSubjectFormatter(
        'Avatar Trait Overridden',
        'citadel.guild',
        'Research Guild',
        'Adaptive Signals',
      ),
    ).toBe('citadel.guild.research_guild.adaptive_signals.avatar_trait_overridden');
  });
});

describe('ResearchSignalPipe', () => {
  it('forwards inbound signal payloads to the research subject namespace', async () => {
    const client = new FakeNatsClient();
    const pipe = new ResearchSignalPipe({
      client,
      inboundSubject: 'citadel.builder.analytics.signal',
      outboundSubjectPrefix: 'citadel',
      sourceGuild: 'builder',
      targetGuild: 'research',
      namespace: 'thesis',
      logger: { log: () => {}, warn: () => {}, error: () => {} },
    });

    await pipe.start();
    client.emit('citadel.builder.analytics.signal', {
      event_type: 'avatar_completed',
      thesis_id: 'thesis-a-rag',
      acceptance_rate: 0.72,
    });

    await waitFor(() =>
      client.published.some(
        (entry) =>
          entry.subject === 'citadel.research.thesis.avatar_completed',
      ),
    );

    const publishedEvent = client.published.find(
      (entry) => entry.subject === 'citadel.research.thesis.avatar_completed',
    );
    expect(publishedEvent).toBeDefined();
    const decoded: Record<string, unknown> = JSON.parse(
      publishedEvent?.data ?? '{}',
    );
    expect(decoded.source_guild).toBe('builder');
    expect(decoded.target_guild).toBe('research');
    expect(decoded.forwarded_from_subject).toBe(
      'citadel.builder.analytics.signal',
    );
    expect(typeof decoded.forwarded_at).toBe('string');

    await pipe.stop();
  });

  it('uses eventType when event_type is not present', async () => {
    const client = new FakeNatsClient();
    const pipe = new ResearchSignalPipe({
      client,
      inboundSubject: 'citadel.builder.analytics.signal',
      outboundSubjectPrefix: 'citadel',
      sourceGuild: 'builder',
      targetGuild: 'research',
      namespace: 'thesis',
      logger: { log: () => {}, warn: () => {}, error: () => {} },
    });

    await pipe.start();
    client.emit('citadel.builder.analytics.signal', {
      eventType: 'trait_overridden',
    });
    await waitFor(() =>
      client.published.some(
        (entry) => entry.subject === 'citadel.research.thesis.trait_overridden',
      ),
    );
    await pipe.stop();
  });

  it('logs parse failures and remains active for later messages', async () => {
    const errors: string[] = [];
    const client = new FakeNatsClient();
    const pipe = new ResearchSignalPipe({
      client,
      inboundSubject: 'citadel.builder.analytics.signal',
      outboundSubjectPrefix: 'citadel',
      sourceGuild: 'builder',
      targetGuild: 'research',
      namespace: 'thesis',
      logger: {
        log: () => {},
        warn: () => {},
        error: (message: string) => errors.push(message),
      },
    });

    await pipe.start();
    client.emitRaw('citadel.builder.analytics.signal', '{not-json');
    await waitFor(() => errors.length > 0);

    client.emit('citadel.builder.analytics.signal', {
      event_type: 'avatar_abandoned',
    });
    await waitFor(() =>
      client.published.some(
        (entry) => entry.subject === 'citadel.research.thesis.avatar_abandoned',
      ),
    );

    await pipe.stop();
  });

  it('rejects missing required construction parameters', () => {
    const client = new FakeNatsClient();

    expect(
      () =>
        new ResearchSignalPipe({
          client,
          inboundSubject: '',
          outboundSubjectPrefix: 'citadel',
          sourceGuild: 'builder',
          targetGuild: 'research',
        }),
    ).toThrow(/inboundSubject/);

    expect(
      () =>
        new ResearchSignalPipe({
          client,
          inboundSubject: 'x',
          outboundSubjectPrefix: '',
          sourceGuild: 'builder',
          targetGuild: 'research',
        }),
    ).toThrow(/outboundSubjectPrefix/);
  });
});