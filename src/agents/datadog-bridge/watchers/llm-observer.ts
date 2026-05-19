import type { DatadogBridgeClient } from '../client.js';
import type {
  CostEvent,
  DatadogBridgeSubjects,
  LlmTraceEvent,
  MetricResponse,
  Watcher,
} from '../types.js';

type LlmObserverOptions = {
  client: Pick<DatadogBridgeClient, 'queryMetricTimeseries'>;
  publish: (subject: string, payload: unknown) => void;
  subjects: Pick<
    DatadogBridgeSubjects,
    'llmTrace' | 'llmError' | 'llmCost' | 'llmLatency'
  >;
  pollIntervalMs: number;
  latencyThresholdMs: number;
  errorRateThreshold: number;
  throughputDropRatio: number;
  promptTokenCostUsd: number;
  completionTokenCostUsd: number;
  model?: string;
  mlApp?: string;
  logger?: Pick<Console, 'warn' | 'error'>;
  now?: () => Date;
};

type LlmSnapshot = {
  successCount: number;
  errorCount: number;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
};

const SUCCESS_QUERY = 'sum:nvidia_nim.vllm_request_success.count{*}.as_count()';
const ERROR_QUERY = 'sum:nvidia_nim.vllm_request_error.count{*}.as_count()';
const LATENCY_QUERY = 'avg:nvidia_nim.vllm_e2e_request_latency_seconds{*}';
const PROMPT_TOKENS_QUERY = 'sum:nvidia_nim.vllm_prompt_tokens{*}';
const COMPLETION_TOKENS_QUERY = 'sum:nvidia_nim.vllm_generation_tokens{*}';

function readLatestValue(response: MetricResponse): number {
  let latestTimestamp = -1;
  let latestValue = 0;

  for (const series of response.series) {
    for (const point of series.points) {
      if (point.timestamp > latestTimestamp) {
        latestTimestamp = point.timestamp;
        latestValue = point.value;
      }
    }
  }
  return latestValue;
}

function normalizeLatencyMs(rawLatencySeconds: number): number {
  return rawLatencySeconds * 1000;
}

export class LlmObserver implements Watcher {
  readonly name = 'llm-observer';

  private readonly options: Required<
    Omit<LlmObserverOptions, 'model' | 'mlApp'>
  > &
    Pick<LlmObserverOptions, 'model' | 'mlApp'>;
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private previousSnapshot: LlmSnapshot | null = null;
  private pollCount = 0;
  private errorCount = 0;
  private lastPollAt: string | undefined;

  constructor(options: LlmObserverOptions) {
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
    const nowSeconds = Math.floor(now.getTime() / 1000);
    const fromSeconds = nowSeconds - Math.floor(this.options.pollIntervalMs / 1000);
    const timestamp = now.toISOString();
    this.lastPollAt = timestamp;
    this.pollCount += 1;

    try {
      const [
        successResponse,
        errorResponse,
        latencyResponse,
        promptTokenResponse,
        completionTokenResponse,
      ] = await Promise.all([
        this.options.client.queryMetricTimeseries(
          SUCCESS_QUERY,
          fromSeconds,
          nowSeconds,
        ),
        this.options.client.queryMetricTimeseries(
          ERROR_QUERY,
          fromSeconds,
          nowSeconds,
        ),
        this.options.client.queryMetricTimeseries(
          LATENCY_QUERY,
          fromSeconds,
          nowSeconds,
        ),
        this.options.client.queryMetricTimeseries(
          PROMPT_TOKENS_QUERY,
          fromSeconds,
          nowSeconds,
        ),
        this.options.client.queryMetricTimeseries(
          COMPLETION_TOKENS_QUERY,
          fromSeconds,
          nowSeconds,
        ),
      ]);

      const snapshot: LlmSnapshot = {
        successCount: readLatestValue(successResponse),
        errorCount: readLatestValue(errorResponse),
        latencyMs: normalizeLatencyMs(readLatestValue(latencyResponse)),
        promptTokens: readLatestValue(promptTokenResponse),
        completionTokens: readLatestValue(completionTokenResponse),
      };

      const errorRate =
        snapshot.successCount + snapshot.errorCount > 0
          ? snapshot.errorCount / (snapshot.successCount + snapshot.errorCount)
          : 0;

      const traceEvent: LlmTraceEvent = {
        kind: 'llm.trace',
        timestamp,
        source: 'datadog.llm',
        title: 'llm inference summary',
        model: this.options.model,
        promptTokens: snapshot.promptTokens,
        completionTokens: snapshot.completionTokens,
        latencyMs: snapshot.latencyMs,
        mlApp: this.options.mlApp,
        attributes: {
          successCount: snapshot.successCount,
          errorCount: snapshot.errorCount,
          errorRate,
        },
      };
      this.options.publish(this.options.subjects.llmTrace, traceEvent);

      if (snapshot.latencyMs > this.options.latencyThresholdMs) {
        const latencyEvent: LlmTraceEvent = {
          kind: 'llm.latency',
          timestamp,
          source: 'datadog.llm',
          title: 'llm latency threshold exceeded',
          model: this.options.model,
          latencyMs: snapshot.latencyMs,
          mlApp: this.options.mlApp,
          attributes: {
            thresholdMs: this.options.latencyThresholdMs,
          },
        };
        this.options.publish(this.options.subjects.llmLatency, latencyEvent);
      }

      const throughputDropped =
        this.previousSnapshot !== null &&
        this.previousSnapshot.successCount > 0 &&
        snapshot.successCount <
          this.previousSnapshot.successCount *
            (1 - this.options.throughputDropRatio);

      if (errorRate > this.options.errorRateThreshold || throughputDropped) {
        const errorEvent: LlmTraceEvent = {
          kind: 'llm.error',
          timestamp,
          source: 'datadog.llm',
          title: 'llm anomaly detected',
          model: this.options.model,
          mlApp: this.options.mlApp,
          promptTokens: snapshot.promptTokens,
          completionTokens: snapshot.completionTokens,
          latencyMs: snapshot.latencyMs,
          attributes: {
            errorRate,
            errorRateThreshold: this.options.errorRateThreshold,
            throughputDropped,
          },
        };
        this.options.publish(this.options.subjects.llmError, errorEvent);
      }

      const costEvent: CostEvent = {
        timestamp,
        model: this.options.model ?? 'unknown',
        mlApp: this.options.mlApp,
        promptTokens: snapshot.promptTokens,
        completionTokens: snapshot.completionTokens,
        estimatedCostUsd:
          snapshot.promptTokens * this.options.promptTokenCostUsd +
          snapshot.completionTokens * this.options.completionTokenCostUsd,
      };
      this.options.publish(this.options.subjects.llmCost, costEvent);

      this.previousSnapshot = snapshot;
    } catch (err) {
      this.errorCount += 1;
      const message = err instanceof Error ? err.message : String(err);
      this.options.logger.error(`[datadog-bridge] llm observer failed: ${message}`);
    }
  }
}