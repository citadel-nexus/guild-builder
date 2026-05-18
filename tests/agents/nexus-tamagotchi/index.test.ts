import { describe, expect, it } from 'vitest';

import {
  NexusTamagotchiRuntime,
  type NexusTamagotchiConfig,
} from '../../../src/agents/nexus-tamagotchi/index.js';

function buildRuntime(): NexusTamagotchiRuntime {
  const config: NexusTamagotchiConfig = {
    agentId: 'nexus-test',
    natsUrl: 'nats://localhost:4222',
    subjectPrefix: 'citadel.builder.nexus',
    debug: false,
  };
  const natsConnection = {
    drain: async (): Promise<void> => undefined,
  };
  return new NexusTamagotchiRuntime(config, natsConnection, {});
}

describe('NexusTamagotchiRuntime', () => {
  it('records lingo interactions and exposes profile display output', () => {
    const runtime = buildRuntime();
    runtime.recordLingoInteraction(
      'Yo fam can we review this architecture and deployment path?',
      'user-1',
    );

    const profile = runtime.getLingoProfile('user-1');
    expect(profile?.interactionCount).toBe(1);
    expect(profile?.slangFrequency.yo).toBe(1);

    const rendered = runtime.displayLingoProfile('user-1');
    expect(rendered).toContain('LINGO PROFILE: user-1');
  });

  it('exposes preflight and cognitive status helpers', () => {
    const runtime = buildRuntime();
    runtime.setPreflightAssessment({
      available: true,
      readyToDeploy: false,
      totalChecks: 4,
      passedChecks: 3,
      failedChecks: 1,
      warnings: 1,
    });

    const preflight = runtime.getPreflightAssessment();
    expect(preflight.available).toBe(true);
    expect(preflight.failedChecks).toBe(1);
    expect(runtime.displayPreflightStatus()).toContain('Status: NOT READY');

    runtime.setCognitiveSystemStatus('nlp_mca', {
      available: true,
      initialized: false,
    });
    const operations = runtime.runCognitiveOperationsTest();
    expect(operations.ok).toBe(false);
    expect(operations.failed).toContain('nlp_mca');
    expect(runtime.displayCognitiveStatus()).toContain(
      'EXTENDED COGNITIVE SYSTEMS STATUS',
    );
  });
});