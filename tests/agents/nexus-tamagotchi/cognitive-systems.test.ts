import { describe, expect, it } from 'vitest';

import {
  CognitiveSystemsRegistry,
  buildPreflightAssessment,
  renderCognitiveSystemsStatus,
  renderPreflightAssessment,
} from '../../../src/agents/nexus-tamagotchi/cognitive-systems.js';

describe('cognitive systems support', () => {
  it('tracks system availability and initialization state', () => {
    const systems = new CognitiveSystemsRegistry();
    systems.setSystemStatus('nlp_mca', {
      available: true,
      initialized: true,
      signalCount: 5,
    });

    const status = systems.getStatus();
    expect(status.nlp_mca.available).toBe(true);
    expect(status.nlp_mca.initialized).toBe(true);
    expect(status.nlp_mca.signalCount).toBe(5);

    const rendered = renderCognitiveSystemsStatus(status);
    expect(rendered).toContain('EXTENDED COGNITIVE SYSTEMS STATUS');
    expect(rendered).toContain('nlp_mca: available, initialized');
  });

  it('builds and renders preflight assessment with recommendations', () => {
    const assessment = buildPreflightAssessment({
      available: true,
      readyToDeploy: false,
      totalChecks: 10,
      passedChecks: 8,
      failedChecks: 2,
      warnings: 1,
      stageResults: [
        {
          stageName: 'dependencies',
          passed: true,
          checks: 3,
          durationMs: 12,
        },
        {
          stageName: 'security',
          passed: false,
          checks: 2,
          durationMs: 9,
        },
      ],
    });

    expect(assessment.recommendations.length).toBeGreaterThan(0);
    const rendered = renderPreflightAssessment(assessment);
    expect(rendered).toContain('Status: NOT READY');
    expect(rendered).toContain('dependencies: PASS');
    expect(rendered).toContain('security: FAIL');
  });
});