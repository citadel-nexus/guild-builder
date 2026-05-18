import { connect, type NatsConnection, type Subscription } from 'nats';

import { DatadogApiClient } from './client.js';
import { DatadogCommandHandler } from './command-handler.js';
import { CompositePublisher } from './integrations/composite-publisher.js';
import { CustomerIoOutboundPublisher } from './integrations/customerio-outbound.js';
import { PostHogOutboundPublisher } from './integrations/posthog-outbound.js';
import { DatadogMonitorWatcher } from './monitor-watcher.js';
import { makeDatadogBridgeSubjects } from './subjects.js';
import type {
  CustomerIoOutboundConfig,
  DatadogBridgeConfig,
  DatadogNatsClient,
  DatadogNatsMessage,
  DatadogNatsSubscription,
  OutboundPublisher,
  PostHogOutboundConfig,
} from './types.js';
import { DatadogMonitorReactor } from './watchers/monitor-reactor.js';

const DEFAULT_SUBJECT_PREFIX = 'citadel.builder.datadog';
const DEFAULT_SITE = 'us5.datadoghq.com';
const DEFAULT_POLL_INTERVAL_MS = 60_000;

export type DatadogBridgeStartResult = {
  started: boolean;
  reason?: string;
  stop?: () => Promise<void>;
};

type ConfigParseResult =
  | {
      ok: true;
      config: DatadogBridgeConfig;
    }
  | {
      ok: false;
      reason: string;
    };

function parsePositiveInteger(rawValue: string | undefined): number | null {
  if (!rawValue) {
    return null;
  }
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseConfig(env: NodeJS.ProcessEnv): ConfigParseResult {
  const apiKey = env.DD_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: 'DD_API_KEY is required' };
  }
  const appKey = env.DD_APP_KEY;
  if (!appKey) {
    return { ok: false, reason: 'DD_APP_KEY is required' };
  }
  const natsUrl = env.NATS_URL;
  if (!natsUrl) {
    return { ok: false, reason: 'NATS_URL is required' };
  }
  const pollIntervalRaw = env.DATADOG_POLL_INTERVAL_MS;
  const parsedPollInterval = parsePositiveInteger(pollIntervalRaw);
  if (pollIntervalRaw && parsedPollInterval === null) {
    return {
      ok: false,
      reason: 'DATADOG_POLL_INTERVAL_MS must be a positive integer',
    };
  }

  return {
    ok: true,
    config: {
      apiKey,
      appKey,
      site: env.DD_SITE ?? DEFAULT_SITE,
      natsUrl,
      subjectPrefix: env.DATADOG_NATS_PREFIX ?? DEFAULT_SUBJECT_PREFIX,
      pollIntervalMs: parsedPollInterval ?? DEFAULT_POLL_INTERVAL_MS,
    },
  };
}

function toSubscription(subscription: Subscription): DatadogNatsSubscription {
  return {
    unsubscribe: () => subscription.unsubscribe(),
    async *[Symbol.asyncIterator](): AsyncIterator<DatadogNatsMessage> {
      for await (const message of subscription) {
        yield {
          subject: message.subject,
          data: message.data,
          reply: message.reply,
        };
      }
    },
  };
}

function toNatsClient(nc: NatsConnection): DatadogNatsClient {
  return {
    subscribe: (subject: string) => toSubscription(nc.subscribe(subject)),
    publish: (subject: string, data: Uint8Array) => {
      nc.publish(subject, data);
    },
  };
}

function isEnabled(rawValue: string | undefined): boolean {
  return (rawValue ?? '').toLowerCase() === 'on';
}

function makePostHogPublisher(env: NodeJS.ProcessEnv): OutboundPublisher | null {
  const apiKey = env.POSTHOG_API_KEY;
  const host = env.POSTHOG_HOST;
  if (!apiKey || !host) {
    return null;
  }
  const config: PostHogOutboundConfig = {
    apiKey,
    host,
    distinctIdPrefix: env.POSTHOG_DISTINCT_ID_PREFIX,
  };
  return new PostHogOutboundPublisher(config);
}

function makeCustomerIoPublisher(env: NodeJS.ProcessEnv): OutboundPublisher | null {
  const siteId = env.CUSTOMERIO_SITE_ID;
  const trackApiKey = env.CUSTOMERIO_TRACK_API_KEY;
  if (!siteId || !trackApiKey) {
    return null;
  }
  const regionRaw = (env.CUSTOMERIO_REGION ?? 'us').toLowerCase();
  const config: CustomerIoOutboundConfig = {
    siteId,
    trackApiKey,
    region: regionRaw === 'eu' ? 'eu' : 'us',
  };
  return new CustomerIoOutboundPublisher(config);
}

export async function startDatadogBridge(
  config: DatadogBridgeConfig,
  env: NodeJS.ProcessEnv = process.env,
): Promise<DatadogBridgeStartResult> {
  const nc = await connect({
    servers: config.natsUrl,
    token: env.NATS_TOKEN,
  });

  const natsClient = toNatsClient(nc);
  const datadogClient = new DatadogApiClient({ config });
  const monitorWatcher = new DatadogMonitorWatcher({
    client: datadogClient,
    natsClient,
    subjectPrefix: config.subjectPrefix,
    pollIntervalMs: config.pollIntervalMs,
  });
  const commandHandler = new DatadogCommandHandler({
    client: datadogClient,
    natsClient,
    subjectPrefix: config.subjectPrefix,
  });

  await monitorWatcher.start();
  await commandHandler.start();

  let reactor: DatadogMonitorReactor | null = null;
  if (isEnabled(env.DATADOG_OUTBOUND_ENABLED)) {
    const publishers: OutboundPublisher[] = [];
    const posthog = makePostHogPublisher(env);
    const customerio = makeCustomerIoPublisher(env);
    if (posthog) {
      publishers.push(posthog);
    }
    if (customerio) {
      publishers.push(customerio);
    }
    if (publishers.length > 0) {
      reactor = new DatadogMonitorReactor({
        natsClient,
        subjectPrefix: config.subjectPrefix,
        publisher: publishers.length === 1 ? publishers[0] : new CompositePublisher(publishers),
      });
      await reactor.start();
    }
  }

  return {
    started: true,
    stop: async () => {
      if (reactor) {
        await reactor.stop();
      }
      await commandHandler.stop();
      await monitorWatcher.stop();
      await nc.drain();
    },
  };
}

export async function maybeStartDatadogBridge(
  env: NodeJS.ProcessEnv = process.env,
): Promise<DatadogBridgeStartResult> {
  if (!isEnabled(env.DATADOG_BRIDGE)) {
    return { started: false, reason: 'DATADOG_BRIDGE != on' };
  }

  const configResult = parseConfig(env);
  if (!configResult.ok) {
    return { started: false, reason: configResult.reason };
  }

  return startDatadogBridge(configResult.config, env);
}

export { makeDatadogBridgeSubjects } from './subjects.js';

export type {
  CustomerIoOutboundConfig,
  DatadogBridgeConfig,
  DatadogCommand,
  DatadogCommandResult,
  DatadogEvent,
  DatadogEventKind,
  DatadogSeverity,
  OutboundPublisher,
  PostHogOutboundConfig,
} from './types.js';
