import { describe, expect, it } from 'vitest';

import { buildDatadogBridgeSubjects } from '../../../../src/agents/datadog-bridge/subjects.js';
import type { MetricSubmission } from '../../../../src/agents/datadog-bridge/types.js';
import {
  GovernanceSynthesizer,
  fetchGovernanceSource,
  parseGovernanceDirectives,
  synthesizeGovernanceDirectives,
} from '../../../../src/agents/datadog-bridge/watchers/governance-synthesizer.js';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

describe('governance-synthesizer', () => {
  it('fetches governance source from a URL', async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      expect(String(input)).toBe('https://example.com/governance.txt');
      expect(init?.method).toBe('GET');
      return new Response('  keep subjects env-driven  ', {
        status: 200,
        headers: {
          'content-type': 'text/plain',
        },
      });
    };

    const source = await fetchGovernanceSource({
      sourceUrl: 'https://example.com/governance.txt',
      fetchImpl,
    });

    expect(source).toBe('keep subjects env-driven');
  });

  it('fetches governance source from a nats subject', async () => {
    let fetchCalled = false;
    const fetchImpl: typeof fetch = async () => {
      fetchCalled = true;
      return new Response('', { status: 200 });
    };

    const source = await fetchGovernanceSource({
      sourceUrl: 'nats://citadel.builder.governance.source',
      fetchImpl,
      requestNatsSource: async (subject) => {
        expect(subject).toBe('citadel.builder.governance.source');
        return 'enforce strict governance';
      },
    });

    expect(fetchCalled).toBe(false);
    expect(source).toBe('enforce strict governance');
  });

  it('parses fenced JSON directives', () => {
    const directives = parseGovernanceDirectives(`\`\`\`json
[
  {
    "priority": "critical",
    "directive": "Require SRS and dispatch references",
    "rationale": "Traceability is mandatory"
  },
  {
    "priority": "high",
    "directive": "Keep NATS subjects config-driven",
    "rationale": "Avoid tenant lock-in"
  }
]
\`\`\``);

    expect(directives).toHaveLength(2);
    expect(directives[0]).toMatchObject({
      priority: 'critical',
      directive: 'Require SRS and dispatch references',
    });
  });

  it('builds NVIDIA NIM requests and parses synthesis output', async () => {
    let requestBody: unknown = null;

    const fetchImpl: typeof fetch = async (input, init) => {
      expect(String(input)).toBe('http://localhost:8000/v1/chat/completions');
      expect(init?.method).toBe('POST');
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe('Bearer nim-key');

      if (typeof init?.body !== 'string') {
        throw new Error('body must be serialized JSON');
      }

      requestBody = JSON.parse(init.body);
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  priority: 'medium',
                  directive: 'Use typed exceptions for failures',
                  rationale: 'Typed failures are easier to route',
                },
              ]),
            },
          },
        ],
      });
    };

    const synthesis = await synthesizeGovernanceDirectives({
      sourceText: 'governance text',
      nimBaseUrl: 'http://localhost:8000/v1/chat/completions',
      nimModel: 'meta/llama-3.1-8b-instruct',
      nimApiKey: 'nim-key',
      nimMaxTokens: 1024,
      nimTemperature: 0.1,
      fetchImpl,
    });

    expect(requestBody).toMatchObject({
      model: 'meta/llama-3.1-8b-instruct',
      max_tokens: 1024,
      temperature: 0.1,
    });
    expect(synthesis.directives).toHaveLength(1);
    expect(synthesis.directives[0]?.directive).toBe(
      'Use typed exceptions for failures',
    );
    expect(synthesis.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('publishes synthesized governance event and metrics', async () => {
    let fetchCalls = 0;
    const published: Array<{ subject: string; payload: unknown }> = [];
    const metricBatches: MetricSubmission[][] = [];

    const fetchImpl: typeof fetch = async () => {
      fetchCalls += 1;
      if (fetchCalls === 1) {
        return new Response('governance-doc-content', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        });
      }
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  priority: 'high',
                  directive: 'Publish heartbeat and watcher stats',
                  rationale: 'Operators need runtime visibility',
                },
              ]),
            },
          },
        ],
      });
    };

    const watcher = new GovernanceSynthesizer({
      client: {
        submitMetrics: async (metrics) => {
          metricBatches.push(metrics);
        },
      },
      publish: (subject, payload) => {
        published.push({ subject, payload });
      },
      subjects: buildDatadogBridgeSubjects('citadel.builder.datadog'),
      sourceUrl: 'https://example.com/governance.txt',
      pollIntervalMs: 60_000,
      nimBaseUrl: 'http://localhost:8000/v1/chat/completions',
      nimModel: 'meta/llama-3.1-8b-instruct',
      nimMaxTokens: 4096,
      nimTemperature: 0.1,
      fetchImpl,
      now: () => new Date('2026-05-27T00:00:00.000Z'),
      logger: { warn: () => {}, error: () => {} },
    });

    await watcher.start();
    await watcher.stop();

    expect(watcher.getPollCount()).toBe(1);
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({
      subject: 'citadel.builder.datadog.governance.synthesized',
      payload: {
        kind: 'governance.synthesized',
      },
    });

    const metricNames = metricBatches
      .flat()
      .map((metric) => metric.metric)
      .sort();
    expect(metricNames).toEqual(
      expect.arrayContaining([
        'governance.synthesis.duration_ms',
        'governance.synthesis.directives_count',
        'governance.synthesis.input_chars',
        'governance.synthesis.output_chars',
      ]),
    );
  });

  it('emits an error metric when NVIDIA NIM is unavailable', async () => {
    let fetchCalls = 0;
    const metricBatches: MetricSubmission[][] = [];

    const fetchImpl: typeof fetch = async () => {
      fetchCalls += 1;
      if (fetchCalls === 1) {
        return new Response('governance-doc-content', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        });
      }
      return new Response('nim unavailable', {
        status: 503,
        headers: { 'content-type': 'text/plain' },
      });
    };

    const watcher = new GovernanceSynthesizer({
      client: {
        submitMetrics: async (metrics) => {
          metricBatches.push(metrics);
        },
      },
      publish: () => {},
      subjects: buildDatadogBridgeSubjects('citadel.builder.datadog'),
      sourceUrl: 'https://example.com/governance.txt',
      pollIntervalMs: 60_000,
      nimBaseUrl: 'http://localhost:8000/v1/chat/completions',
      nimModel: 'meta/llama-3.1-8b-instruct',
      nimMaxTokens: 4096,
      nimTemperature: 0.1,
      fetchImpl,
      logger: { warn: () => {}, error: () => {} },
      now: () => new Date('2026-05-27T00:00:00.000Z'),
    });

    await watcher.start();
    await watcher.stop();

    expect(watcher.getErrorCount()).toBe(1);
    expect(metricBatches).toHaveLength(1);
    expect(metricBatches[0]?.[0]).toMatchObject({
      metric: 'governance.synthesis.errors',
      type: 'count',
    });
  });

  it('emits an error metric when the governance source is empty', async () => {
    const metricBatches: MetricSubmission[][] = [];

    const watcher = new GovernanceSynthesizer({
      client: {
        submitMetrics: async (metrics) => {
          metricBatches.push(metrics);
        },
      },
      publish: () => {},
      subjects: buildDatadogBridgeSubjects('citadel.builder.datadog'),
      sourceUrl: 'https://example.com/governance.txt',
      pollIntervalMs: 60_000,
      nimBaseUrl: 'http://localhost:8000/v1/chat/completions',
      nimModel: 'meta/llama-3.1-8b-instruct',
      nimMaxTokens: 4096,
      nimTemperature: 0.1,
      fetchImpl: async () =>
        new Response('   ', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        }),
      logger: { warn: () => {}, error: () => {} },
      now: () => new Date('2026-05-27T00:00:00.000Z'),
    });

    await watcher.start();
    await watcher.stop();

    expect(watcher.getErrorCount()).toBe(1);
    expect(metricBatches[0]?.[0]).toMatchObject({
      metric: 'governance.synthesis.errors',
      type: 'count',
    });
  });
});