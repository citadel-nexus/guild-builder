import { isRecord } from '../codec.js';
import type { DatadogBridgeClient } from '../client.js';
import type {
  DatadogBridgeSubjects,
  GovernanceDirective,
  GovernanceSynthesisEvent,
  GovernanceSynthesisResult,
  MetricSubmission,
  Watcher,
} from '../types.js';

type NatsSourceRequester = (subject: string) => Promise<string>;

type GovernanceSourceRequestOptions = {
  sourceUrl: string;
  fetchImpl: typeof fetch;
  requestNatsSource?: NatsSourceRequester;
};

type GovernanceSynthesisRequestOptions = {
  sourceText: string;
  nimBaseUrl: string;
  nimModel: string;
  nimApiKey?: string;
  nimMaxTokens: number;
  nimTemperature: number;
  fetchImpl: typeof fetch;
};

type GovernanceSynthesisResponse = {
  directives: GovernanceDirective[];
  outputText: string;
  durationMs: number;
};

type GovernanceSynthesizerOptions = {
  client: Pick<DatadogBridgeClient, 'submitMetrics'>;
  publish: (subject: string, payload: unknown) => void;
  subjects: Pick<DatadogBridgeSubjects, 'governanceSynthesized'>;
  sourceUrl: string;
  pollIntervalMs: number;
  nimBaseUrl: string;
  nimModel: string;
  nimApiKey?: string;
  nimMaxTokens: number;
  nimTemperature?: number;
  fetchImpl?: typeof fetch;
  requestNatsSource?: NatsSourceRequester;
  logger?: Pick<Console, 'warn' | 'error'>;
  now?: () => Date;
};

const GOVERNANCE_SYNTHESIS_SYSTEM_PROMPT =
  'You are a governance synthesis engine. Read the governance document and extract ranked directives. ' +
  'Return only JSON. The payload must be a JSON array of objects with keys: priority, directive, rationale. ' +
  'priority must be one of: critical, high, medium, low. Keep directives concise and actionable.';

function normalizeDirectivePriority(
  value: unknown,
): GovernanceDirective['priority'] | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'critical' ||
    normalized === 'high' ||
    normalized === 'medium' ||
    normalized === 'low'
  ) {
    return normalized;
  }
  return null;
}

function normalizeDirective(value: unknown): GovernanceDirective | null {
  if (!isRecord(value)) {
    return null;
  }

  const priority = normalizeDirectivePriority(value.priority);
  const directive =
    typeof value.directive === 'string' ? value.directive.trim() : '';
  const rationale =
    typeof value.rationale === 'string' ? value.rationale.trim() : '';

  if (!priority || !directive || !rationale) {
    return null;
  }

  return {
    priority,
    directive,
    rationale,
  };
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }
  const withoutStart = trimmed.replace(/^```[a-zA-Z0-9_-]*\s*/, '');
  return withoutStart.replace(/\s*```$/, '').trim();
}

function parseJsonCandidate(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function collectCandidateJsonStrings(content: string): string[] {
  const normalized = stripCodeFence(content);
  const candidates = [normalized];

  const arrayStart = normalized.indexOf('[');
  const arrayEnd = normalized.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    candidates.push(normalized.slice(arrayStart, arrayEnd + 1));
  }

  const objectStart = normalized.indexOf('{');
  const objectEnd = normalized.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.push(normalized.slice(objectStart, objectEnd + 1));
  }

  return candidates;
}

export function parseGovernanceDirectives(content: string): GovernanceDirective[] {
  const candidates = collectCandidateJsonStrings(content);
  let parsedPayload: unknown | null = null;

  for (const candidate of candidates) {
    const parsed = parseJsonCandidate(candidate);
    if (parsed !== null) {
      parsedPayload = parsed;
      break;
    }
  }

  if (parsedPayload === null) {
    throw new Error('NIM response did not contain valid JSON');
  }

  let entries: unknown[] = [];
  if (Array.isArray(parsedPayload)) {
    entries = parsedPayload;
  } else if (isRecord(parsedPayload) && Array.isArray(parsedPayload.directives)) {
    entries = parsedPayload.directives;
  } else {
    throw new Error('NIM response JSON must be an array or object with directives');
  }

  const directives = entries
    .map((entry) => normalizeDirective(entry))
    .filter((entry): entry is GovernanceDirective => entry !== null);

  if (directives.length === 0) {
    throw new Error('NIM response contained no valid governance directives');
  }

  return directives;
}

function collectSourceTextFragments(value: unknown, fragments: Set<string>): void {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      fragments.add(trimmed);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectSourceTextFragments(entry, fragments);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const plainText =
    typeof value.plain_text === 'string' ? value.plain_text.trim() : '';
  const text = typeof value.text === 'string' ? value.text.trim() : '';
  const content = typeof value.content === 'string' ? value.content.trim() : '';

  if (plainText) {
    fragments.add(plainText);
  } else if (text) {
    fragments.add(text);
  } else if (content) {
    fragments.add(content);
  }

  for (const child of Object.values(value)) {
    collectSourceTextFragments(child, fragments);
  }
}

export function extractGovernanceSourceText(payload: unknown): string {
  const fragments = new Set<string>();
  collectSourceTextFragments(payload, fragments);
  if (fragments.size > 0) {
    return [...fragments].join('\n');
  }
  const serialized = JSON.stringify(payload);
  return serialized ?? '';
}

function getNatsSourceSubject(sourceUrl: string): string | null {
  if (!sourceUrl.startsWith('nats://')) {
    return null;
  }
  const subject = sourceUrl.slice('nats://'.length).trim();
  return subject || null;
}

export async function fetchGovernanceSource(
  options: GovernanceSourceRequestOptions,
): Promise<string> {
  const natsSubject = getNatsSourceSubject(options.sourceUrl);
  if (natsSubject) {
    if (!options.requestNatsSource) {
      throw new Error('governance source uses nats:// but no requester is configured');
    }
    return (await options.requestNatsSource(natsSubject)).trim();
  }

  const response = await options.fetchImpl(options.sourceUrl, {
    method: 'GET',
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`governance source fetch failed (${response.status}): ${text}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.toLowerCase().includes('application/json')) {
    const payload: unknown = await response.json();
    return extractGovernanceSourceText(payload).trim();
  }

  return (await response.text()).trim();
}

function extractNimContent(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.choices) || payload.choices.length === 0) {
    throw new Error('NIM response is missing choices');
  }

  const firstChoice = payload.choices[0];
  if (!isRecord(firstChoice)) {
    throw new Error('NIM response choice is not an object');
  }

  if (typeof firstChoice.text === 'string' && firstChoice.text.trim()) {
    return firstChoice.text;
  }

  const message = isRecord(firstChoice.message) ? firstChoice.message : null;
  if (!message) {
    throw new Error('NIM response is missing message content');
  }

  if (typeof message.content === 'string' && message.content.trim()) {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    const parts: string[] = [];
    for (const part of message.content) {
      if (isRecord(part) && typeof part.text === 'string' && part.text.trim()) {
        parts.push(part.text);
      }
    }
    if (parts.length > 0) {
      return parts.join('\n');
    }
  }

  throw new Error('NIM response did not include text content');
}

export async function synthesizeGovernanceDirectives(
  options: GovernanceSynthesisRequestOptions,
): Promise<GovernanceSynthesisResponse> {
  const startedAt = Date.now();
  const headers = new Headers();
  headers.set('content-type', 'application/json');
  if (options.nimApiKey) {
    headers.set('authorization', `Bearer ${options.nimApiKey}`);
  }

  const response = await options.fetchImpl(options.nimBaseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: options.nimModel,
      messages: [
        {
          role: 'system',
          content: GOVERNANCE_SYNTHESIS_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: options.sourceText,
        },
      ],
      max_tokens: options.nimMaxTokens,
      temperature: options.nimTemperature,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`NIM synthesis request failed (${response.status}): ${text}`);
  }

  const payload: unknown = await response.json();
  const outputText = extractNimContent(payload);
  const directives = parseGovernanceDirectives(outputText);

  return {
    directives,
    outputText,
    durationMs: Date.now() - startedAt,
  };
}

export class GovernanceSynthesizer implements Watcher {
  readonly name = 'governance-synthesizer';

  private readonly options: Required<
    Omit<GovernanceSynthesizerOptions, 'fetchImpl' | 'requestNatsSource' | 'nimTemperature'>
  > &
    Pick<GovernanceSynthesizerOptions, 'requestNatsSource'> & {
      fetchImpl: typeof fetch;
      nimTemperature: number;
    };
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pollCount = 0;
  private errorCount = 0;
  private lastPollAt: string | undefined;

  constructor(options: GovernanceSynthesizerOptions) {
    this.options = {
      ...options,
      fetchImpl: options.fetchImpl ?? fetch,
      nimTemperature: options.nimTemperature ?? 0.1,
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
    const timestamp = now.toISOString();
    const metricTimestamp = Math.floor(now.getTime() / 1000);
    this.pollCount += 1;
    this.lastPollAt = timestamp;

    try {
      const sourceText = await fetchGovernanceSource({
        sourceUrl: this.options.sourceUrl,
        fetchImpl: this.options.fetchImpl,
        requestNatsSource: this.options.requestNatsSource,
      });

      if (!sourceText.trim()) {
        throw new Error('governance source is empty');
      }

      const synthesis = await synthesizeGovernanceDirectives({
        sourceText,
        nimBaseUrl: this.options.nimBaseUrl,
        nimModel: this.options.nimModel,
        nimApiKey: this.options.nimApiKey,
        nimMaxTokens: this.options.nimMaxTokens,
        nimTemperature: this.options.nimTemperature,
        fetchImpl: this.options.fetchImpl,
      });

      const result: GovernanceSynthesisResult = {
        directives: synthesis.directives,
        sourceChars: sourceText.length,
        outputChars: synthesis.outputText.length,
        model: this.options.nimModel,
        timestamp,
      };

      const event: GovernanceSynthesisEvent = {
        kind: 'governance.synthesized',
        source: 'datadog.governance',
        title: 'governance directives synthesized',
        timestamp,
        result,
      };

      this.options.publish(this.options.subjects.governanceSynthesized, event);

      await this.submitMetrics(metricTimestamp, [
        {
          metric: 'governance.synthesis.duration_ms',
          type: 'gauge',
          points: [{ timestamp: metricTimestamp, value: synthesis.durationMs }],
          tags: this.buildMetricTags(),
        },
        {
          metric: 'governance.synthesis.directives_count',
          type: 'gauge',
          points: [
            { timestamp: metricTimestamp, value: synthesis.directives.length },
          ],
          tags: this.buildMetricTags(),
        },
        {
          metric: 'governance.synthesis.input_chars',
          type: 'gauge',
          points: [{ timestamp: metricTimestamp, value: sourceText.length }],
          tags: this.buildMetricTags(),
        },
        {
          metric: 'governance.synthesis.output_chars',
          type: 'gauge',
          points: [{ timestamp: metricTimestamp, value: synthesis.outputText.length }],
          tags: this.buildMetricTags(),
        },
      ]);
    } catch (err) {
      this.errorCount += 1;
      const message = err instanceof Error ? err.message : String(err);
      this.options.logger.error(
        `[datadog-bridge] governance synthesizer failed: ${message}`,
      );
      await this.submitMetrics(metricTimestamp, [
        {
          metric: 'governance.synthesis.errors',
          type: 'count',
          points: [{ timestamp: metricTimestamp, value: 1 }],
          tags: this.buildMetricTags(),
        },
      ]);
    }
  }

  private buildMetricTags(): string[] {
    const sourceTag = this.options.sourceUrl.startsWith('nats://')
      ? 'source:nats'
      : 'source:url';
    return [
      'agent:datadog-bridge',
      'watcher:governance-synthesizer',
      sourceTag,
      `model:${this.options.nimModel}`,
    ];
  }

  private async submitMetrics(
    timestamp: number,
    metrics: MetricSubmission[],
  ): Promise<void> {
    const sanitized = metrics.map((metric) => ({
      ...metric,
      points: metric.points.map((point) => ({
        timestamp: point.timestamp || timestamp,
        value: point.value,
      })),
    }));
    try {
      await this.options.client.submitMetrics(sanitized);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.options.logger.warn(
        `[datadog-bridge] governance synthesizer metric submission failed: ${message}`,
      );
    }
  }
}