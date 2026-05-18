import { describe, expect, it } from 'vitest';

import { buildDatadogBridgeSubjects } from '../../../../src/agents/datadog-bridge/subjects.js';
import { LlmObserver } from '../../../../src/agents/datadog-bridge/watchers/llm-observer.js';
import type { MetricResponse } from '../../../../src/agents/datadog-bridge/types.js';

function metricResponse(value: number): MetricResponse {
  return {
    from: 0,
    to: 1,
    series: [
      {
        metric: 'test.metric',
        tags: [],
        points: [{ timestamp: Date.now(), value }],
      },
    ],
  };
}

describe('LlmObserver', () => {
  it('publishes trace, cost, and anomaly events', async () => {
    const published: Array<{ subject: string; payload: unknown }> = [];
    let success = 100;
    let error = 10;
    let latencySeconds = 6;
    let promptTokens = 1000;
    let completionTokens = 500;

    const observer = new LlmObserver({
      client: {
        queryMetricTimeseries: async (query) => {
          if (query.includes('request_success')) {
            return metricResponse(success);
          }
          if (query.includes('request_error')) {
            return metricResponse(error);
          }
          if (query.includes('e2e_request_latency')) {
            return metricResponse(latencySeconds);
          }
          if (query.includes('prompt_tokens')) {
            return metricResponse(promptTokens);
          }
          return metricResponse(completionTokens);
        },
      },
      publish: (subject, payload) => {
        published.push({ subject, payload });
      },
      subjects: buildDatadogBridgeSubjects('citadel.builder.datadog'),
      pollIntervalMs: 60_000,
      latencyThresholdMs: 5_000,
      errorRateThreshold: 0.05,
      throughputDropRatio: 0.4,
      promptTokenCostUsd: 0.000001,
      completionTokenCostUsd: 0.000002,
      model: 'qwen',
      mlApp: 'builder-ai',
      now: () => new Date('2026-05-18T00:00:00.000Z'),
      logger: { warn: () => {}, error: () => {} },
    });

    await observer.start();

    success = 20;
    error = 0;
    latencySeconds = 7;
    promptTokens = 1200;
    completionTokens = 800;

    await observer.runOnce();
    await observer.stop();

    const subjects = published.map((entry) => entry.subject);
    expect(subjects).toContain('citadel.builder.datadog.llm.trace');
    expect(subjects).toContain('citadel.builder.datadog.llm.cost');
    expect(subjects).toContain('citadel.builder.datadog.llm.latency');
    expect(subjects).toContain('citadel.builder.datadog.llm.error');
    expect(observer.getPollCount()).toBe(2);
  });
});