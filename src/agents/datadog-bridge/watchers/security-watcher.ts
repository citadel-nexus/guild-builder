import type { DatadogBridgeClient } from '../client.js';
import type {
  DatadogBridgeSubjects,
  PostureSummary,
  SecurityFinding,
  SecuritySignal,
  Watcher,
} from '../types.js';

type SecurityWatcherOptions = {
  client: Pick<DatadogBridgeClient, 'searchSecuritySignals' | 'getSecurityFindings'>;
  publish: (subject: string, payload: unknown) => void;
  subjects: Pick<
    DatadogBridgeSubjects,
    'securitySignal' | 'securityFinding' | 'securityPosture'
  >;
  pollIntervalMs: number;
  postureIntervalMs?: number;
  logger?: Pick<Console, 'warn' | 'error'>;
  now?: () => Date;
};

type SeverityCounter = Record<SecuritySignal['severity'], number>;
type TypeCounter = Record<SecurityFinding['findingType'], number>;

function emptySeverityCounter(): SeverityCounter {
  return {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
}

function emptyTypeCounter(): TypeCounter {
  return {
    vulnerability: 0,
    misconfiguration: 0,
    secret: 0,
    identity_risk: 0,
  };
}

export class SecurityWatcher implements Watcher {
  readonly name = 'security-watcher';

  private readonly options: Required<SecurityWatcherOptions>;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private lastPollIso: string | null = null;
  private lastPosturePublishMs = 0;
  private readonly seenSignalIds = new Set<string>();
  private readonly seenFindingIds = new Set<string>();
  private pollCount = 0;
  private errorCount = 0;
  private lastPollAt: string | undefined;

  constructor(options: SecurityWatcherOptions) {
    this.options = {
      ...options,
      postureIntervalMs: options.postureIntervalMs ?? 5 * 60_000,
      logger: options.logger ?? console,
      now: options.now ?? (() => new Date()),
    };
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    await this.runOnce();
    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.options.pollIntervalMs);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  getPollCount(): number {
    return this.pollCount;
  }

  getErrorCount(): number {
    return this.errorCount;
  }

  getLastPollAt(): string | undefined {
    return this.lastPollAt;
  }

  async runOnce(): Promise<void> {
    if (!this.running) {
      return;
    }

    const now = this.options.now();
    const to = now.toISOString();
    const from =
      this.lastPollIso ??
      new Date(now.getTime() - this.options.pollIntervalMs).toISOString();

    this.lastPollIso = to;
    this.lastPollAt = to;
    this.pollCount += 1;

    try {
      const signalResponse = await this.options.client.searchSecuritySignals(
        'status:open',
        from,
        to,
      );

      for (const signal of signalResponse.signals) {
        if (this.seenSignalIds.has(signal.id)) {
          continue;
        }
        this.seenSignalIds.add(signal.id);
        const event: SecuritySignal = {
          kind: 'security.signal',
          id: signal.id,
          timestamp: to,
          source: 'datadog.security',
          title: signal.rule ?? 'security signal',
          severity: signal.severity,
          rule: signal.rule,
          attributes: signal.attributes,
        };
        this.options.publish(this.options.subjects.securitySignal, event);
      }

      const findingsResponse = await this.options.client.getSecurityFindings(
        '@status:open',
      );

      for (const finding of findingsResponse.findings) {
        if (this.seenFindingIds.has(finding.id)) {
          continue;
        }
        this.seenFindingIds.add(finding.id);
        const event: SecurityFinding = {
          kind: 'security.finding',
          id: finding.id,
          timestamp: to,
          source: 'datadog.security',
          title: finding.resource ?? 'security finding',
          severity: finding.severity,
          findingType: finding.findingType,
          resource: finding.resource,
          remediation: finding.remediation,
          attributes: finding.attributes,
        };
        this.options.publish(this.options.subjects.securityFinding, event);
      }

      const shouldPublishPosture =
        now.getTime() - this.lastPosturePublishMs >=
        this.options.postureIntervalMs;
      if (shouldPublishPosture) {
        this.lastPosturePublishMs = now.getTime();
        const bySeverity = emptySeverityCounter();
        const byType = emptyTypeCounter();
        for (const finding of findingsResponse.findings) {
          bySeverity[finding.severity] += 1;
          byType[finding.findingType] += 1;
        }
        const summary: PostureSummary = {
          timestamp: to,
          totalFindings: findingsResponse.findings.length,
          bySeverity,
          byType,
        };
        this.options.publish(this.options.subjects.securityPosture, summary);
      }
    } catch (err) {
      this.errorCount += 1;
      const message = err instanceof Error ? err.message : String(err);
      this.options.logger.error(`[datadog-bridge] security watcher failed: ${message}`);
    }
  }
}