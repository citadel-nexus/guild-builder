import { StringCodec, connect } from 'nats';

import { AutomationEngine } from './automation-engine.js';
import { DatadogBridgeClient } from './client.js';
import { encodeJson } from './codec.js';
import { resolveDatadogBridgeConfig, validateDatadogBridgeConfig } from './config.js';
import { IntegrationBridge, createDefaultIntegrations } from './integrations/integration-bridge.js';
import { buildDatadogBridgeSubjects } from './subjects.js';
import type { HeartbeatEvent, NatsLikeConnection, Watcher } from './types.js';
import { GovernanceSynthesizer } from './watchers/governance-synthesizer.js';
import { LlmObserver } from './watchers/llm-observer.js';
import { SecurityWatcher } from './watchers/security-watcher.js';

export type DatadogBridgeAutoStartResult = {
  started: boolean;
  reason?: string;
  stop?: () => Promise<void>;
};

function readOptionalNumberMethod(target: object, methodName: string): number {
  const candidate = Reflect.get(target, methodName);
  if (typeof candidate !== 'function') {
    return 0;
  }
  const result = Reflect.apply(candidate, target, []);
  return typeof result === 'number' && Number.isFinite(result) ? result : 0;
}

function readOptionalStringMethod(
  target: object,
  methodName: string,
): string | undefined {
  const candidate = Reflect.get(target, methodName);
  if (typeof candidate !== 'function') {
    return undefined;
  }
  const result = Reflect.apply(candidate, target, []);
  return typeof result === 'string' ? result : undefined;
}

function publishHeartbeat(
  nats: NatsLikeConnection,
  subject: string,
  watchers: Watcher[],
  startedAtMs: number,
): void {
  const pollCount = watchers.reduce(
    (total, watcher) => total + readOptionalNumberMethod(watcher, 'getPollCount'),
    0,
  );
  const errorCount = watchers.reduce(
    (total, watcher) => total + readOptionalNumberMethod(watcher, 'getErrorCount'),
    0,
  );
  const heartbeat: HeartbeatEvent = {
    agent: 'datadog-bridge',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startedAtMs) / 1000),
    watchers: watchers.map((watcher) => ({
      name: watcher.name,
      running: watcher.isRunning(),
      lastPoll: readOptionalStringMethod(watcher, 'getLastPollAt'),
    })),
    pollCount,
    errorCount,
  };
  nats.publish(subject, encodeJson(heartbeat));
}

export async function maybeStartDatadogBridge(
  env: NodeJS.ProcessEnv = process.env,
): Promise<DatadogBridgeAutoStartResult> {
  const config = resolveDatadogBridgeConfig(env);
  const invalidReason = validateDatadogBridgeConfig(config);
  if (invalidReason) {
    return {
      started: false,
      reason: invalidReason,
    };
  }

  const natsConnection = await connect({
    servers: config.natsUrl,
    token: config.natsToken,
  });
  const stringCodec = StringCodec();
  const nats: NatsLikeConnection = natsConnection;
  const subjects = buildDatadogBridgeSubjects(config.subjectPrefix);
  const client = new DatadogBridgeClient({ config });
  const watchers: Watcher[] = [];

  if (config.securityEnabled) {
    watchers.push(
      new SecurityWatcher({
        client,
        publish: (subject, payload) => nats.publish(subject, encodeJson(payload)),
        subjects,
        pollIntervalMs: config.pollIntervalMs,
      }),
    );
  }

  if (config.llmEnabled) {
    watchers.push(
      new LlmObserver({
        client,
        publish: (subject, payload) => nats.publish(subject, encodeJson(payload)),
        subjects,
        pollIntervalMs: config.pollIntervalMs,
        latencyThresholdMs: config.llmLatencyThresholdMs,
        errorRateThreshold: config.llmErrorRateThreshold,
        throughputDropRatio: config.llmThroughputDropRatio,
        promptTokenCostUsd: config.llmPromptTokenCostUsd,
        completionTokenCostUsd: config.llmCompletionTokenCostUsd,
        model: config.llmModel,
        mlApp: config.llmApplication,
      }),
    );
  }

  if (config.governanceEnabled) {
    watchers.push(
      new GovernanceSynthesizer({
        client,
        publish: (subject, payload) => nats.publish(subject, encodeJson(payload)),
        subjects,
        sourceUrl: config.governanceSourceUrl,
        pollIntervalMs: config.governancePollIntervalMs,
        nimBaseUrl: config.nimBaseUrl,
        nimModel: config.nimModel,
        nimApiKey: config.nimApiKey,
        nimMaxTokens: config.nimMaxTokens,
        nimTemperature: config.nimTemperature,
        requestNatsSource: async (subject) => {
          const response = await natsConnection.request(
            subject,
            stringCodec.encode(''),
            { timeout: 10_000 },
          );
          return stringCodec.decode(response.data);
        },
      }),
    );
  }

  if (config.automationEnabled) {
    watchers.push(
      new AutomationEngine({
        client,
        nats,
        subjects,
      }),
    );
  }

  if (config.integrationsEnabled) {
    watchers.push(
      new IntegrationBridge({
        nats,
        integrations: createDefaultIntegrations({
          client,
          subjects,
        }),
      }),
    );
  }

  for (const watcher of watchers) {
    await watcher.start();
  }

  const startedAtMs = Date.now();
  publishHeartbeat(nats, subjects.heartbeat, watchers, startedAtMs);
  const heartbeatTimer = setInterval(() => {
    publishHeartbeat(nats, subjects.heartbeat, watchers, startedAtMs);
  }, config.pollIntervalMs);

  return {
    started: true,
    stop: async () => {
      clearInterval(heartbeatTimer);
      for (const watcher of [...watchers].reverse()) {
        await watcher.stop();
      }
      await natsConnection.drain();
    },
  };
}