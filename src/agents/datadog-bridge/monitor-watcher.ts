import type {
  DatadogBridgeClient,
  DatadogEvent,
  DatadogNatsClient,
  DatadogSeverity,
} from './types.js';

type MonitorSignal = {
  statusToken: 'alert' | 'warn' | 'ok' | 'nodata';
  kind: DatadogEvent['kind'];
  severity: DatadogSeverity;
};

const encoder = new TextEncoder();

function encode(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

function tagsToMap(tags: string[]): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const tag of tags) {
    const separator = tag.indexOf(':');
    if (separator < 0) {
      mapped[tag] = 'true';
      continue;
    }
    const key = tag.slice(0, separator);
    const value = tag.slice(separator + 1);
    if (key) {
      mapped[key] = value;
    }
  }
  return mapped;
}

function mapMonitorState(state: string): MonitorSignal | null {
  const normalized = state.trim().toLowerCase();
  if (normalized === 'alert') {
    return {
      statusToken: 'alert',
      kind: 'monitor.alert',
      severity: 'critical',
    };
  }
  if (normalized === 'warn' || normalized === 'warning') {
    return {
      statusToken: 'warn',
      kind: 'monitor.warn',
      severity: 'warning',
    };
  }
  if (normalized === 'ok') {
    return {
      statusToken: 'ok',
      kind: 'monitor.ok',
      severity: 'ok',
    };
  }
  if (normalized === 'no data' || normalized === 'nodata' || normalized === 'no_data') {
    return {
      statusToken: 'nodata',
      kind: 'monitor.nodata',
      severity: 'warning',
    };
  }
  return null;
}

export type DatadogMonitorWatcherOptions = {
  client: Pick<DatadogBridgeClient, 'fetchMonitorStatuses'>;
  natsClient: Pick<DatadogNatsClient, 'publish'>;
  subjectPrefix: string;
  pollIntervalMs: number;
  logger?: Pick<Console, 'warn' | 'error'>;
  nowMs?: () => number;
  waitMs?: (ms: number) => Promise<void>;
};

const defaultWaitMs = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

export class DatadogMonitorWatcher {
  private readonly client: Pick<DatadogBridgeClient, 'fetchMonitorStatuses'>;
  private readonly natsClient: Pick<DatadogNatsClient, 'publish'>;
  private readonly subjectPrefix: string;
  private readonly pollIntervalMs: number;
  private readonly logger: Pick<Console, 'warn' | 'error'>;
  private readonly nowMs: () => number;
  private readonly waitMs: (ms: number) => Promise<void>;
  private readonly monitorState = new Map<number, string>();
  private running = false;
  private runLoopPromise: Promise<void> | null = null;

  constructor(options: DatadogMonitorWatcherOptions) {
    this.client = options.client;
    this.natsClient = options.natsClient;
    this.subjectPrefix = options.subjectPrefix;
    this.pollIntervalMs = options.pollIntervalMs;
    this.logger = options.logger ?? console;
    this.nowMs = options.nowMs ?? Date.now;
    this.waitMs = options.waitMs ?? defaultWaitMs;

    if (this.pollIntervalMs <= 0) {
      throw new Error('DatadogMonitorWatcher pollIntervalMs must be > 0');
    }
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    this.runLoopPromise = this.runLoop();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.runLoopPromise) {
      await this.runLoopPromise;
      this.runLoopPromise = null;
    }
  }

  async pollOnce(): Promise<void> {
    const startedMs = this.nowMs();
    const timestamp = new Date(startedMs).toISOString();
    const monitorResult = await this.client.fetchMonitorStatuses();

    if (!monitorResult.ok) {
      this.logger.warn(
        `[datadog-bridge] monitor poll failed (${monitorResult.statusCode}): ${monitorResult.error}`,
      );
      this.publishHeartbeat(timestamp, {
        monitor_count: '0',
        transitions: '0',
        status: 'error',
      });
      return;
    }

    let transitions = 0;
    for (const monitor of monitorResult.data) {
      const signal = mapMonitorState(monitor.overallState);
      if (!signal) {
        continue;
      }
      const previous = this.monitorState.get(monitor.id);
      if (previous !== signal.statusToken) {
        transitions += 1;
        this.publishMonitorEvent(timestamp, signal, monitor);
      }
      this.monitorState.set(monitor.id, signal.statusToken);
    }

    this.publishHeartbeat(timestamp, {
      monitor_count: String(monitorResult.data.length),
      transitions: String(transitions),
      status: 'ok',
    });
  }

  private async runLoop(): Promise<void> {
    while (this.running) {
      const cycleStarted = this.nowMs();
      try {
        await this.pollOnce();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`[datadog-bridge] poll loop error: ${message}`);
      }

      const elapsed = this.nowMs() - cycleStarted;
      const sleepFor = Math.max(this.pollIntervalMs - elapsed, 0);
      if (!this.running) {
        break;
      }
      if (sleepFor > 0) {
        await this.waitMs(sleepFor);
      }
    }
  }

  private publishMonitorEvent(
    timestamp: string,
    signal: MonitorSignal,
    monitor: {
      id: number;
      name: string;
      message?: string;
      tags: string[];
      raw: Record<string, unknown>;
    },
  ): void {
    const subject = `${this.subjectPrefix}.monitor.${signal.statusToken}`;
    const event: DatadogEvent = {
      kind: signal.kind,
      source: `monitor:${monitor.id}`,
      title: monitor.name,
      detail: monitor.message,
      tags: {
        ...tagsToMap(monitor.tags),
        monitor_id: String(monitor.id),
        monitor_status: signal.statusToken,
      },
      severity: signal.severity,
      timestamp,
      raw: monitor.raw,
    };
    this.natsClient.publish(subject, encode(event));
  }

  private publishHeartbeat(
    timestamp: string,
    tags: Record<string, string>,
  ): void {
    const subject = `${this.subjectPrefix}.heartbeat`;
    const heartbeat: DatadogEvent = {
      kind: 'agent.heartbeat',
      source: 'datadog-bridge',
      title: 'Datadog bridge poll cycle',
      tags,
      severity: tags.status === 'ok' ? 'ok' : 'warning',
      timestamp,
    };
    this.natsClient.publish(subject, encode(heartbeat));
  }
}