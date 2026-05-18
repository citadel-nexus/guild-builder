import { describe, expect, it } from 'vitest';

import { createGitlabIntegration } from '../../../../src/agents/datadog-bridge/integrations/gitlab.js';
import type { CIPipelineSubmission, MetricSubmission } from '../../../../src/agents/datadog-bridge/types.js';

describe('createGitlabIntegration', () => {
  it('forwards pipeline events and emits metrics', async () => {
    const submittedPipelines: CIPipelineSubmission[] = [];
    const submittedMetrics: MetricSubmission[][] = [];
    const integration = createGitlabIntegration({
      inboundSubject: 'citadel.builder.datadog.integration.gitlab.pipeline',
      client: {
        submitCIPipelineEvent: async (pipeline) => {
          submittedPipelines.push(pipeline);
        },
        submitMetrics: async (metrics) => {
          submittedMetrics.push(metrics);
        },
      },
    });

    await integration.handle({
      pipelineId: 77,
      status: 'success',
      ref: 'main',
      duration: 120,
      project: 'citadel-nexus/guild-builder',
    });

    expect(submittedPipelines).toHaveLength(1);
    expect(submittedPipelines[0]).toMatchObject({
      pipelineId: 77,
      status: 'success',
      ref: 'main',
    });

    expect(submittedMetrics).toHaveLength(1);
    expect(submittedMetrics[0].some((metric) => metric.metric === 'citadel.gitlab.pipeline.count')).toBe(true);
  });
});