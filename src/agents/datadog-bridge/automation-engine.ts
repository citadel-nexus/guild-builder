import { randomUUID } from 'node:crypto';

import { decodeJson, encodeJson, readNumber, readRecord, readString, readStringArray } from './codec.js';
import type { DatadogBridgeClient } from './client.js';
import type {
  CreateMonitorCommand,
  DatadogBridgeSubjects,
  DowntimeCommand,
  MuteCommand,
  NatsLikeConnection,
  NatsLikeMessage,
  NatsLikeSubscription,
  SnapshotCommand,
  Watcher,
} from './types.js';

type AutomationEngineOptions = {
  client: Pick<
    DatadogBridgeClient,
    'muteMonitor' | 'createMonitor' | 'createDowntime' | 'snapshotDashboard'
  >;
  nats: NatsLikeConnection;
  subjects: Pick<
    DatadogBridgeSubjects,
    | 'automationMute'
    | 'automationCreateMonitor'
    | 'automationSnapshot'
    | 'automationDowntime'
    | 'automationResultPrefix'
  >;
  logger?: Pick<Console, 'log' | 'warn' | 'error'>;
  now?: () => Date;
};

type AutomationResult = {
  requestId: string;
  action: string;
  ok: boolean;
  timestamp: string;
  error?: string;
  data?: Record<string, unknown>;
};

function readRequestId(payload: Record<string, unknown>): string {
  const value = readString(payload.requestId, 'requestId');
  return value ?? randomUUID();
}

function readReplySubject(payload: Record<string, unknown>): string | undefined {
  return readString(payload.replyTo, 'replyTo');
}

function parseMuteCommand(payload: Record<string, unknown>): MuteCommand {
  const monitorId = readNumber(payload.monitorId, 'monitorId');
  if (monitorId === undefined) {
    throw new Error('monitorId is required');
  }
  const scope = readString(payload.scope, 'scope');
  const endTs = readNumber(payload.endTs, 'endTs');
  const reason = readString(payload.reason, 'reason');
  return { monitorId, scope, endTs, reason };
}

function parseCreateMonitorCommand(
  payload: Record<string, unknown>,
): CreateMonitorCommand {
  const name = readString(payload.name, 'name');
  const type = readString(payload.type, 'type');
  const query = readString(payload.query, 'query');
  if (!name || !type || !query) {
    throw new Error('name, type, and query are required');
  }

  const message = readString(payload.message, 'message');
  const tags = readStringArray(payload.tags, 'tags');
  const thresholdsRecord = payload.thresholds
    ? readRecord(payload.thresholds, 'thresholds')
    : undefined;

  const thresholds: Record<string, number> | undefined = thresholdsRecord
    ? Object.entries(thresholdsRecord).reduce<Record<string, number>>(
        (accumulator, [key, value]) => {
          const parsed = readNumber(value, `thresholds.${key}`);
          if (parsed !== undefined) {
            accumulator[key] = parsed;
          }
          return accumulator;
        },
        {},
      )
    : undefined;

  return {
    name,
    type,
    query,
    message,
    tags,
    thresholds,
  };
}

function parseDowntimeCommand(payload: Record<string, unknown>): DowntimeCommand {
  const scope = readString(payload.scope, 'scope');
  const startTs = readNumber(payload.startTs, 'startTs');
  const endTs = readNumber(payload.endTs, 'endTs');
  if (!scope || startTs === undefined || endTs === undefined) {
    throw new Error('scope, startTs, and endTs are required');
  }
  const message = readString(payload.message, 'message');
  const monitorTags = readStringArray(payload.monitorTags, 'monitorTags');
  return {
    scope,
    startTs,
    endTs,
    message,
    monitorTags,
  };
}

function parseSnapshotCommand(payload: Record<string, unknown>): SnapshotCommand {
  const dashboardId = readString(payload.dashboardId, 'dashboardId');
  const timeframe = readString(payload.timeframe, 'timeframe');
  if (!dashboardId || !timeframe) {
    throw new Error('dashboardId and timeframe are required');
  }
  return {
    dashboardId,
    timeframe,
  };
}

export class AutomationEngine implements Watcher {
  readonly name = 'automation-engine';

  private readonly options: Required<AutomationEngineOptions>;
  private readonly subscriptions: NatsLikeSubscription[] = [];
  private running = false;

  constructor(options: AutomationEngineOptions) {
    this.options = {
      ...options,
      logger: options.logger ?? console,
      now: options.now ?? (() => new Date()),
    };
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;

    const actions: Array<{
      subject: string;
      action: string;
      handler: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
    }> = [
      {
        subject: this.options.subjects.automationMute,
        action: 'automation.mute',
        handler: async (payload) => {
          const cmd = parseMuteCommand(payload);
          await this.options.client.muteMonitor(cmd.monitorId, {
            scope: cmd.scope,
            endTs: cmd.endTs,
          });
          return { monitorId: cmd.monitorId, scope: cmd.scope };
        },
      },
      {
        subject: this.options.subjects.automationCreateMonitor,
        action: 'automation.create-monitor',
        handler: async (payload) => {
          const cmd = parseCreateMonitorCommand(payload);
          const response = await this.options.client.createMonitor({
            name: cmd.name,
            type: cmd.type,
            query: cmd.query,
            message: cmd.message,
            tags: cmd.tags,
            thresholds: cmd.thresholds,
          });
          return {
            monitorId: response.id,
            name: response.name,
          };
        },
      },
      {
        subject: this.options.subjects.automationDowntime,
        action: 'automation.downtime',
        handler: async (payload) => {
          const cmd = parseDowntimeCommand(payload);
          const response = await this.options.client.createDowntime({
            scope: cmd.scope,
            startTs: cmd.startTs,
            endTs: cmd.endTs,
            message: cmd.message,
            monitorTags: cmd.monitorTags,
          });
          return {
            downtimeId: response.id,
            scope: response.scope,
          };
        },
      },
      {
        subject: this.options.subjects.automationSnapshot,
        action: 'automation.snapshot',
        handler: async (payload) => {
          const cmd = parseSnapshotCommand(payload);
          const response = await this.options.client.snapshotDashboard(
            cmd.dashboardId,
            cmd.timeframe,
          );
          return {
            snapshotUrl: response.snapshotUrl,
          };
        },
      },
    ];

    for (const action of actions) {
      const sub = this.options.nats.subscribe(action.subject);
      this.subscriptions.push(sub);
      void this.consumeSubscription(sub, action.action, action.handler);
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

  private async consumeSubscription(
    sub: NatsLikeSubscription,
    action: string,
    handler: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>,
  ): Promise<void> {
    for await (const msg of sub) {
      await this.handleMessage(msg, action, handler);
    }
  }

  private async handleMessage(
    msg: NatsLikeMessage,
    action: string,
    handler: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>,
  ): Promise<void> {
    const timestamp = this.options.now().toISOString();
    let requestId: string = randomUUID();
    let replySubject: string | undefined;

    try {
      const payload = readRecord(decodeJson(msg.data), 'payload');
      requestId = readRequestId(payload);
      replySubject = readReplySubject(payload);
      const data = await handler(payload);
      const result: AutomationResult = {
        requestId,
        action,
        ok: true,
        timestamp,
        data,
      };
      this.publishResult(result, msg, replySubject);
      this.options.logger.log(
        `[datadog-bridge] automation ${action} succeeded (${requestId})`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const result: AutomationResult = {
        requestId,
        action,
        ok: false,
        timestamp,
        error: message,
      };
      this.publishResult(result, msg, replySubject);
      this.options.logger.error(
        `[datadog-bridge] automation ${action} failed (${requestId}): ${message}`,
      );
    }
  }

  private publishResult(
    result: AutomationResult,
    msg: NatsLikeMessage,
    replySubject?: string,
  ): void {
    const subject =
      replySubject ??
      `${this.options.subjects.automationResultPrefix}.${result.requestId}`;
    const encoded = encodeJson(result);
    this.options.nats.publish(subject, encoded);
    if (msg.respond) {
      msg.respond(encoded);
    }
  }
}
