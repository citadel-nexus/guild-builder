const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type ResearchPipeMessage = {
  subject: string;
  data: Uint8Array;
};

export type ResearchPipeSubscription = AsyncIterable<ResearchPipeMessage> & {
  unsubscribe: () => void;
};

export type ResearchPipeNatsClient = {
  subscribe: (subject: string) => ResearchPipeSubscription;
  publish: (subject: string, data: Uint8Array) => void;
  drain?: () => Promise<void>;
  close?: () => Promise<void>;
};

export type ResearchSubjectFormatter = (
  eventType: string,
  outboundSubjectPrefix: string,
  targetGuild: string,
  namespace: string,
) => string;

export type ResearchPipeOptions = {
  client: ResearchPipeNatsClient;
  inboundSubject: string;
  outboundSubjectPrefix: string;
  sourceGuild: string;
  targetGuild: string;
  namespace?: string;
  subjectFormatter?: ResearchSubjectFormatter;
  logger?: Pick<Console, 'log' | 'warn' | 'error'>;
};

function normalizeSegment(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'signal';
}

export function defaultResearchSubjectFormatter(
  eventType: string,
  outboundSubjectPrefix: string,
  targetGuild: string,
  namespace: string,
): string {
  const safeGuild = normalizeSegment(targetGuild);
  const safeEventType = normalizeSegment(eventType);
  const safeNamespace = normalizeSegment(namespace);
  return `${outboundSubjectPrefix}.${safeGuild}.${safeNamespace}.${safeEventType}`;
}

function decodePayload(data: Uint8Array): unknown {
  const raw = decoder.decode(data);
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `research pipe: invalid JSON payload (${
        err instanceof Error ? err.message : String(err)
      })`,
    );
  }
}

function encodePayload(payload: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(payload));
}

function coerceRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new Error('research pipe: payload is not an object');
  }
  return Object.fromEntries(Object.entries(value));
}

function resolveEventType(
  payload: Readonly<Record<string, unknown>>,
): string {
  const eventType = payload.event_type;
  if (typeof eventType === 'string' && eventType.trim()) {
    return eventType;
  }

  const camelEventType = payload.eventType;
  if (typeof camelEventType === 'string' && camelEventType.trim()) {
    return camelEventType;
  }

  return 'signal';
}

export class ResearchSignalPipe {
  private readonly opts: Required<Omit<ResearchPipeOptions, 'logger'>>;
  private readonly logger: Pick<Console, 'log' | 'warn' | 'error'>;
  private subscription: ResearchPipeSubscription | null = null;
  private running = false;

  constructor(options: ResearchPipeOptions) {
    if (!options.inboundSubject) {
      throw new Error('ResearchSignalPipe requires inboundSubject');
    }
    if (!options.outboundSubjectPrefix) {
      throw new Error('ResearchSignalPipe requires outboundSubjectPrefix');
    }
    if (!options.sourceGuild) {
      throw new Error('ResearchSignalPipe requires sourceGuild');
    }
    if (!options.targetGuild) {
      throw new Error('ResearchSignalPipe requires targetGuild');
    }

    this.opts = {
      client: options.client,
      inboundSubject: options.inboundSubject,
      outboundSubjectPrefix: options.outboundSubjectPrefix,
      sourceGuild: options.sourceGuild,
      targetGuild: options.targetGuild,
      namespace: options.namespace ?? 'thesis',
      subjectFormatter:
        options.subjectFormatter ?? defaultResearchSubjectFormatter,
    };
    this.logger = options.logger ?? console;
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.subscription = this.opts.client.subscribe(this.opts.inboundSubject);
    this.running = true;

    this.logger.log(
      `[automation] research pipe listening on ${this.opts.inboundSubject} -> ${this.opts.outboundSubjectPrefix}.${this.opts.targetGuild}.${this.opts.namespace}.*`,
    );

    void this.consume(this.subscription);
  }

  private async consume(sub: ResearchPipeSubscription): Promise<void> {
    try {
      for await (const message of sub) {
        try {
          const parsed = decodePayload(message.data);
          const payload = coerceRecord(parsed);
          const eventType = resolveEventType(payload);
          const subject = this.opts.subjectFormatter(
            eventType,
            this.opts.outboundSubjectPrefix,
            this.opts.targetGuild,
            this.opts.namespace,
          );

          const forwarded = {
            ...payload,
            source_guild: this.opts.sourceGuild,
            target_guild: this.opts.targetGuild,
            forwarded_at: new Date().toISOString(),
            forwarded_from_subject: message.subject,
          };

          this.opts.client.publish(subject, encodePayload(forwarded));
        } catch (err) {
          const messageText = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `[automation] research pipe failed on ${message.subject}: ${messageText}`,
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