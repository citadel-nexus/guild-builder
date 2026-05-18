import type {
  DatadogApiResult,
  DatadogBridgeClient,
  DatadogCommand,
  DatadogCommandAction,
  DatadogCommandResult,
  DatadogNatsClient,
  DatadogNatsMessage,
  DatadogNatsSubscription,
  DatadogMuteMonitorOptions,
} from './types.js';

type JsonMap = Record<string, unknown>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const KNOWN_ACTIONS: readonly DatadogCommandAction[] = [
  'query.metric',
  'query.logs',
  'query.monitors',
  'create.monitor',
  'mute.monitor',
  'snapshot.dashboard',
  'list.services',
];

function isJsonMap(value: unknown): value is JsonMap {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(source: JsonMap, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumber(source: JsonMap, key: string): number | undefined {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readObject(source: JsonMap, key: string): JsonMap | undefined {
  const value = source[key];
  return isJsonMap(value) ? value : undefined;
}

function parseAction(value: string): DatadogCommandAction | undefined {
  for (const known of KNOWN_ACTIONS) {
    if (known === value) {
      return known;
    }
  }
  return undefined;
}

function decodeJson(data: Uint8Array): unknown {
  const text = decoder.decode(data);
  if (!text) {
    return {};
  }
  return JSON.parse(text);
}

function encode(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

function numberParam(params: JsonMap, key: string): number | undefined {
  const direct = readNumber(params, key);
  if (direct !== undefined) {
    return direct;
  }
  const maybeString = readString(params, key);
  if (!maybeString) {
    return undefined;
  }
  const parsed = Number(maybeString);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

export type DatadogCommandHandlerOptions = {
  client: DatadogBridgeClient;
  natsClient: DatadogNatsClient;
  subjectPrefix: string;
  logger?: Pick<Console, 'warn' | 'error'>;
  nowMs?: () => number;
};

export class DatadogCommandHandler {
  private readonly client: DatadogBridgeClient;
  private readonly natsClient: DatadogNatsClient;
  private readonly subjectPrefix: string;
  private readonly logger: Pick<Console, 'warn' | 'error'>;
  private readonly nowMs: () => number;
  private subscription: DatadogNatsSubscription | null = null;
  private running = false;

  constructor(options: DatadogCommandHandlerOptions) {
    this.client = options.client;
    this.natsClient = options.natsClient;
    this.subjectPrefix = options.subjectPrefix;
    this.logger = options.logger ?? console;
    this.nowMs = options.nowMs ?? Date.now;
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    const subject = `${this.subjectPrefix}.command.>`;
    const subscription = this.natsClient.subscribe(subject);
    this.subscription = subscription;
    this.running = true;
    void this.consume(subscription);
  }

  async stop(): Promise<void> {
    this.running = false;
    this.subscription?.unsubscribe();
    this.subscription = null;
  }

  private async consume(subscription: DatadogNatsSubscription): Promise<void> {
    for await (const message of subscription) {
      try {
        await this.handleMessage(message);
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        this.logger.error(`[datadog-bridge] command handling failed: ${text}`);
      }
    }
    this.running = false;
  }

  private async handleMessage(message: DatadogNatsMessage): Promise<void> {
    const startedAt = this.nowMs();
    const parsed = this.parseCommand(message.data);
    const requestId = parsed.requestId ?? 'invalid-request';
    const replySubject =
      parsed.replySubject ??
      message.reply ??
      `${this.subjectPrefix}.result.${requestId}`;

    if (!parsed.command) {
      const result: DatadogCommandResult = {
        requestId,
        status: 'error',
        error: parsed.error,
        durationMs: this.nowMs() - startedAt,
      };
      this.natsClient.publish(replySubject, encode(result));
      return;
    }

    const execution = await this.execute(parsed.command);
    const result: DatadogCommandResult = execution.ok
      ? {
          requestId: parsed.command.requestId,
          status: 'ok',
          data: execution.data,
          durationMs: this.nowMs() - startedAt,
        }
      : {
          requestId: parsed.command.requestId,
          status: 'error',
          error: execution.error,
          durationMs: this.nowMs() - startedAt,
        };

    this.natsClient.publish(replySubject, encode(result));
  }

  private parseCommand(data: Uint8Array): {
    command?: DatadogCommand;
    requestId?: string;
    replySubject?: string;
    error: string;
  } {
    try {
      const decoded = decodeJson(data);
      if (!isJsonMap(decoded)) {
        return { error: 'command payload must be an object' };
      }

      const requestId = readString(decoded, 'requestId');
      const replySubject = readString(decoded, 'replySubject');
      const actionRaw = readString(decoded, 'action');
      if (!requestId) {
        return {
          requestId,
          replySubject,
          error: 'command.requestId is required',
        };
      }
      if (!actionRaw) {
        return {
          requestId,
          replySubject,
          error: 'command.action is required',
        };
      }
      const action = parseAction(actionRaw);
      if (!action) {
        return {
          requestId,
          replySubject,
          error: `unsupported command.action: ${actionRaw}`,
        };
      }

      const params = readObject(decoded, 'params') ?? {};
      return {
        command: {
          action,
          requestId,
          params,
          replySubject,
        },
        requestId,
        replySubject,
        error: '',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: `invalid command JSON: ${message}` };
    }
  }

  private async execute(command: DatadogCommand): Promise<
    | {
        ok: true;
        data: Record<string, unknown>;
      }
    | {
        ok: false;
        error: string;
      }
  > {
    const params = command.params;

    switch (command.action) {
      case 'query.monitors': {
        const result = await this.client.fetchMonitorStatuses();
        return this.mapApiResult(result, (data) => ({ monitors: data }));
      }
      case 'query.metric': {
        const query = readString(params, 'query');
        if (!query) {
          return { ok: false, error: 'params.query is required for query.metric' };
        }
        const nowSeconds = Math.floor(this.nowMs() / 1000);
        const from = numberParam(params, 'from') ?? nowSeconds - 300;
        const to = numberParam(params, 'to') ?? nowSeconds;
        if (to <= from) {
          return { ok: false, error: 'params.to must be greater than params.from' };
        }
        const result = await this.client.queryMetric(query, from, to);
        return this.mapApiResult(result, (data) => ({ metric: data }));
      }
      case 'query.logs': {
        const query = readString(params, 'query') ?? '*';
        const from = readString(params, 'from') ?? 'now-15m';
        const to = readString(params, 'to') ?? 'now';
        const result = await this.client.searchLogs(query, from, to);
        return this.mapApiResult(result, (data) => ({ logs: data }));
      }
      case 'create.monitor': {
        const monitorDefinition = readObject(params, 'monitor') ?? params;
        if (Object.keys(monitorDefinition).length === 0) {
          return { ok: false, error: 'params.monitor is required for create.monitor' };
        }
        const result = await this.client.createMonitor(monitorDefinition);
        return this.mapApiResult(result, (data) => ({ monitor: data }));
      }
      case 'mute.monitor': {
        const monitorId =
          numberParam(params, 'monitorId') ?? numberParam(params, 'id');
        if (monitorId === undefined) {
          return {
            ok: false,
            error: 'params.monitorId (or params.id) is required for mute.monitor',
          };
        }
        const options = readObject(params, 'options') ?? {};
        const muteOptions: DatadogMuteMonitorOptions = options;
        const result = await this.client.muteMonitor(monitorId, muteOptions);
        return this.mapApiResult(result, (data) => ({ monitor: data }));
      }
      case 'snapshot.dashboard': {
        const dashboardId =
          readString(params, 'dashboardId') ?? readString(params, 'id');
        if (!dashboardId) {
          return {
            ok: false,
            error: 'params.dashboardId (or params.id) is required for snapshot.dashboard',
          };
        }
        const result = await this.client.snapshotDashboard(dashboardId);
        return this.mapApiResult(result, (data) => ({ dashboard: data }));
      }
      case 'list.services': {
        const result = await this.client.listServices();
        return this.mapApiResult(result, (data) => ({ services: data.services }));
      }
    }
  }

  private mapApiResult<T>(
    result: DatadogApiResult<T>,
    mapData: (data: T) => Record<string, unknown>,
  ):
    | {
        ok: true;
        data: Record<string, unknown>;
      }
    | {
        ok: false;
        error: string;
      } {
    if (!result.ok) {
      return {
        ok: false,
        error: `Datadog API ${result.statusCode}: ${result.error}`,
      };
    }
    return {
      ok: true,
      data: mapData(result.data),
    };
  }
}