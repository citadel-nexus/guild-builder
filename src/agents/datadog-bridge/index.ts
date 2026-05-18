import { connect, type NatsConnection, type Subscription } from 'nats';

import { DatadogApiClient } from './client.js';
import { DatadogCommandHandler } from './command-handler.js';
import { DatadogMonitorWatcher } from './monitor-watcher.js';
import type {
  DatadogBridgeConfig,
  DatadogNatsClient,
  DatadogNatsMessage,
  DatadogNatsSubscription,
} from './types.js';

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

  return {
    started: true,
    stop: async () => {
      await commandHandler.stop();
      await monitorWatcher.stop();
      await nc.drain();
    },
  };
}

export async function maybeStartDatadogBridge(
  env: NodeJS.ProcessEnv = process.env,
): Promise<DatadogBridgeStartResult> {
  if ((env.DATADOG_BRIDGE ?? '').toLowerCase() !== 'on') {
    return { started: false, reason: 'DATADOG_BRIDGE != on' };
  }

  const configResult = parseConfig(env);
  if (!configResult.ok) {
    return { started: false, reason: configResult.reason };
  }

  return startDatadogBridge(configResult.config, env);
}

export type {
  DatadogBridgeConfig,
  DatadogCommand,
  DatadogCommandResult,
  DatadogEvent,
  DatadogEventKind,
  DatadogSeverity,
} from './types.js';