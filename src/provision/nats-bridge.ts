/**
 * NATS bridge for the ProvisionOrchestrator.
 *
 * Subscribes to a configured "tenant provisioned" inbound subject (the
 * walk-in pipeline emits this when a tenant row + subdomain are created),
 * runs the orchestrator, and publishes ProvisionEvents back onto NATS via
 * the configured subject formatter.
 *
 * Transport-agnostic: pass any NatsLike client. The default factory uses
 * the `nats` package — production deployments wire their own client with
 * JetStream / auth as needed.
 */
import type { ProvisionOrchestrator } from './orchestrator.js';
import {
  defaultSubjectFormatter,
  type SubjectFormatter,
} from './subject-formatter.js';
import type {
  ProvisionEvent,
  ProvisionEventPublisher,
  TenantContext,
} from './types.js';

export type NatsLikeMessage = {
  subject: string;
  data: Uint8Array;
};

export type NatsLikeSubscription = AsyncIterable<NatsLikeMessage> & {
  unsubscribe: () => void;
};

export type NatsLikeClient = {
  subscribe: (subject: string) => NatsLikeSubscription;
  publish: (subject: string, data: Uint8Array) => void;
  drain?: () => Promise<void>;
  close?: () => Promise<void>;
};

export type ProvisionNatsBridgeOptions = {
  client: NatsLikeClient;
  orchestrator: ProvisionOrchestrator;
  inboundSubject: string;
  outboundSubjectPrefix: string;
  subjectFormatter?: SubjectFormatter;
  parseTenantContext?: (raw: unknown) => TenantContext;
  logger?: Pick<Console, 'log' | 'warn' | 'error'>;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encode(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

function decode(data: Uint8Array): unknown {
  const text = decoder.decode(data);
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(
      `provision bridge: invalid JSON payload (${
        err instanceof Error ? err.message : String(err)
      })`,
    );
  }
}

function defaultParseTenantContext(raw: unknown): TenantContext {
  if (!raw || typeof raw !== 'object') {
    throw new Error('provision bridge: payload is not an object');
  }
  const obj = raw as Record<string, unknown>;
  const tenantId =
    typeof obj.tenantId === 'string'
      ? obj.tenantId
      : typeof obj.tenant_id === 'string'
        ? obj.tenant_id
        : undefined;
  if (!tenantId) {
    throw new Error('provision bridge: payload missing tenantId / tenant_id');
  }
  const industry =
    typeof obj.industry === 'string' ? obj.industry : 'unknown';
  const tier =
    obj.tier === 'starter' || obj.tier === 'growth' || obj.tier === 'premium'
      ? obj.tier
      : 'starter';
  const ctx: TenantContext = { tenantId, industry, tier };
  if (typeof obj.domain === 'string') {
    ctx.domain = obj.domain;
  }
  if (obj.metadata && typeof obj.metadata === 'object') {
    ctx.metadata = obj.metadata as Record<string, unknown>;
  }
  return ctx;
}

export class ProvisionNatsBridge {
  private readonly opts: Required<
    Omit<ProvisionNatsBridgeOptions, 'logger'>
  > & {
    logger: Pick<Console, 'log' | 'warn' | 'error'>;
  };
  private subscription: NatsLikeSubscription | null = null;
  private running = false;

  constructor(options: ProvisionNatsBridgeOptions) {
    if (!options.inboundSubject) {
      throw new Error('ProvisionNatsBridge requires inboundSubject');
    }
    if (!options.outboundSubjectPrefix) {
      throw new Error('ProvisionNatsBridge requires outboundSubjectPrefix');
    }
    this.opts = {
      client: options.client,
      orchestrator: options.orchestrator,
      inboundSubject: options.inboundSubject,
      outboundSubjectPrefix: options.outboundSubjectPrefix,
      subjectFormatter: options.subjectFormatter ?? defaultSubjectFormatter,
      parseTenantContext:
        options.parseTenantContext ?? defaultParseTenantContext,
      logger: options.logger ?? console,
    };
  }

  /**
   * Build an event publisher that writes ProvisionEvents to NATS using
   * the configured prefix + formatter. Exposed so callers can also use
   * the same publisher when running the orchestrator inline (without
   * the inbound subscription).
   */
  publisher(): ProvisionEventPublisher {
    const { client, outboundSubjectPrefix, subjectFormatter, logger } =
      this.opts;
    return (event: ProvisionEvent) => {
      const subject = subjectFormatter(event, outboundSubjectPrefix);
      try {
        client.publish(subject, encode(event));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn(`[provision] failed to publish ${subject}: ${message}`);
      }
    };
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    const { client, inboundSubject, parseTenantContext, orchestrator, logger } =
      this.opts;

    const sub = client.subscribe(inboundSubject);
    this.subscription = sub;
    this.running = true;
    logger.log(
      `[provision] bridge listening on ${inboundSubject} -> publishing under ${this.opts.outboundSubjectPrefix}.<tenant>.provision.*`,
    );

    const publish = this.publisher();
    void this.consume(sub, parseTenantContext, orchestrator, publish, logger);
  }

  private async consume(
    sub: NatsLikeSubscription,
    parse: (raw: unknown) => TenantContext,
    orchestrator: ProvisionOrchestrator,
    publish: ProvisionEventPublisher,
    logger: Pick<Console, 'log' | 'warn' | 'error'>,
  ): Promise<void> {
    try {
      for await (const msg of sub) {
        try {
          const ctx = parse(decode(msg.data));
          await orchestrator.run(ctx, { publish });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error(
            `[provision] failed to handle message on ${msg.subject}: ${message}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.running = false;
  }
}
