import { readNumber, readString, readStringArray } from '../codec.js';
import type { DatadogBridgeClient } from '../client.js';
import type { GitLabPipelineEvent, Integration } from '../types.js';

type GitlabIntegrationOptions = {
  client: Pick<
    DatadogBridgeClient,
    'submitCIPipelineEvent' | 'submitMetrics'
  >;
  inboundSubject: string;
};

function parseGitlabPayload(payload: Record<string, unknown>): GitLabPipelineEvent {
  const pipelineId =
    readNumber(payload.pipelineId, 'pipelineId') ??
    readNumber(payload.pipeline_id, 'pipeline_id');
  const status = readString(payload.status, 'status');
  const ref = readString(payload.ref, 'ref');
  if (pipelineId === undefined || !status || !ref) {
    throw new Error('pipelineId, status, and ref are required');
  }

  const duration =
    readNumber(payload.duration, 'duration') ??
    readNumber(payload.duration_seconds, 'duration_seconds');
  const stages = readStringArray(payload.stages, 'stages');
  const project =
    readString(payload.project, 'project') ??
    readString(payload.project_path, 'project_path');

  return {
    pipelineId,
    status,
    ref,
    duration,
    stages,
    project,
  };
}

export function createGitlabIntegration(
  options: GitlabIntegrationOptions,
): Integration {
  return {
    name: 'gitlab',
    inboundSubject: options.inboundSubject,
    handle: async (payload) => {
      const event = parseGitlabPayload(payload);
      const timestamp = Math.floor(Date.now() / 1000);
      const tags = [
        'source:gitlab',
        `status:${event.status}`,
        `ref:${event.ref}`,
      ];
      if (event.project) {
        tags.push(`project:${event.project}`);
      }

      await options.client.submitCIPipelineEvent({
        pipelineId: event.pipelineId,
        status: event.status,
        ref: event.ref,
        durationSeconds: event.duration,
        project: event.project,
        tags,
      });

      const metrics: Array<{
        metric: string;
        type: 'count' | 'gauge';
        points: Array<{ timestamp: number; value: number }>;
        tags: string[];
      }> = [
        {
          metric: 'citadel.gitlab.pipeline.count',
          type: 'count',
          points: [{ timestamp, value: 1 }],
          tags,
        },
      ];

      if (event.duration !== undefined) {
        metrics.push({
          metric: 'citadel.gitlab.pipeline.duration_seconds',
          type: 'gauge',
          points: [{ timestamp, value: event.duration }],
          tags,
        });
      }

      await options.client.submitMetrics(metrics);
    },
  };
}