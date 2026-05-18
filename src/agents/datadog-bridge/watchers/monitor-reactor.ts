import type {
  DatadogEvent,
  DatadogNatsClient,
  DatadogNatsMessage,
  DatadogNatsSubscription,
  OutboundPublisher,
} from '../types.js';
import { makeDatadogBridgeSubjects } from '../subjects.js';

const decoder = new TextDecoder();

type Logger = Pick<Console, 'warn' | 'error'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseEvent(data: Uint8Array): DatadogEvent | null {
  try {
    const decoded = JSON.parse(decoder.decode(data));
    if (!isRecord(decoded)) {
      return null;
    }
    if (typeof decoded.kind !== 'string') {
      return null;
    }
    if (typeof decoded.source !== 'string') {
      return null;
    }
    if (typeof decoded.title !== 'string') {
      return null;
    }
    if (typeof decoded.severity !== 'string') {
      return null;
    }
    if (typeof decoded.timestamp !== 'string') {
      return null;
    }
    return decoded as DatadogEvent;
  } catch {
    return null;
  }
}

export type DatadogMonitorReactorOptions = {
  natsClient: DatadogNatsClient;
  subjectPrefix: string;
  publisher: OutboundPublisher;
  logger?: Logger;
};

export class DatadogMonitorReactor {
  private readonly natsClient: DatadogNatsClient;
  private readonly publisher: OutboundPublisher;
  private readonly logger: Logger;
  private readonly subscriptions: DatadogNatsSubscription[] = [];
  private readonly subjects: string[];
  private running = false;

  constructor(options: DatadogMonitorReactorOptions) {
    this.natsClient = options.natsClient;
    this.publisher = options.publisher;
    this.logger = options.logger ?? console;
    const subjectSet = makeDatadogBridgeSubjects(options.subjectPrefix);
    this.subjects = [
      subjectSet.monitor.alert,
      subjectSet.monitor.warn,
      subjectSet.monitor.ok,
      subjectSet.monitor.nodata,
    ];
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    for (const subject of this.subjects) {
      const subscription = this.natsClient.subscribe(subject);
      this.subscriptions.push(subscription);
      void this.consume(subscription);
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions.length = 0;
  }

  private async consume(subscription: DatadogNatsSubscription): Promise<void> {
    for await (const message of subscription) {
      if (!this.running) {
        break;
      }
      await this.handle(message);
    }
  }

  private async handle(message: DatadogNatsMessage): Promise<void> {
    const event = parseEvent(message.data);
    if (!event) {
      this.logger.warn(`[datadog-bridge] monitor reactor received invalid event on ${message.subject}`);
      return;
    }
    const result = await this.publisher.publish(event);
    if (!result.ok) {
      this.logger.warn(
        `[datadog-bridge] outbound publish failed (${result.publisher}): ${result.error ?? 'unknown error'}`,
      );
    }
  }
}
