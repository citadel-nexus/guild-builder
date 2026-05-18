import { decodeJson, readRecord } from '../codec.js';
import type { DatadogBridgeClient } from '../client.js';
import type {
  DatadogBridgeSubjects,
  Integration,
  NatsLikeConnection,
  NatsLikeSubscription,
  Watcher,
} from '../types.js';
import { createCustomerIoIntegration } from './customerio.js';
import { createGitlabIntegration } from './gitlab.js';
import { createPosthogIntegration } from './posthog.js';
import { createStripeIntegration } from './stripe.js';

type IntegrationBridgeOptions = {
  nats: NatsLikeConnection;
  integrations: Integration[];
  logger?: Pick<Console, 'log' | 'warn' | 'error'>;
};

type DefaultIntegrationOptions = {
  client: Pick<
    DatadogBridgeClient,
    'submitEvent' | 'submitLogs' | 'submitMetrics' | 'submitCIPipelineEvent'
  >;
  subjects: Pick<
    DatadogBridgeSubjects,
    | 'integrationPosthogEvent'
    | 'integrationCustomerIoWebhook'
    | 'integrationGitLabPipeline'
    | 'integrationStripePayment'
  >;
};

export function createDefaultIntegrations(
  options: DefaultIntegrationOptions,
): Integration[] {
  return [
    createPosthogIntegration({
      client: options.client,
      inboundSubject: options.subjects.integrationPosthogEvent,
    }),
    createCustomerIoIntegration({
      client: options.client,
      inboundSubject: options.subjects.integrationCustomerIoWebhook,
    }),
    createGitlabIntegration({
      client: options.client,
      inboundSubject: options.subjects.integrationGitLabPipeline,
    }),
    createStripeIntegration({
      client: options.client,
      inboundSubject: options.subjects.integrationStripePayment,
    }),
  ];
}

export class IntegrationBridge implements Watcher {
  readonly name = 'integration-bridge';

  private readonly options: Required<IntegrationBridgeOptions>;
  private readonly subscriptions: NatsLikeSubscription[] = [];
  private running = false;

  constructor(options: IntegrationBridgeOptions) {
    this.options = {
      ...options,
      logger: options.logger ?? console,
    };
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;

    for (const integration of this.options.integrations) {
      const sub = this.options.nats.subscribe(integration.inboundSubject);
      this.subscriptions.push(sub);
      void this.consume(sub, integration);
      this.options.logger.log(
        `[datadog-bridge] integration ${integration.name} listening on ${integration.inboundSubject}`,
      );
    }
  }

  async stop(): Promise<void> {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
    this.subscriptions.length = 0;
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  private async consume(
    sub: NatsLikeSubscription,
    integration: Integration,
  ): Promise<void> {
    for await (const msg of sub) {
      try {
        const payload = readRecord(decodeJson(msg.data), 'payload');
        await integration.handle(payload);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.options.logger.error(
          `[datadog-bridge] integration ${integration.name} failed: ${message}`,
        );
      }
    }
  }
}