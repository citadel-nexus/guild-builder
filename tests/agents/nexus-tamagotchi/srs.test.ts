import { describe, expect, it } from 'vitest';

import {
  OperationalSRSValidator,
  SRS_REGISTRY,
  getSrsSummary,
  validateSrsCoverage,
} from '../../../src/agents/nexus-tamagotchi/srs.js';

function buildBadgeRecord(count: number): Record<string, unknown> {
  const badges: Record<string, unknown> = {};
  for (let index = 0; index < count; index += 1) {
    badges[`badge-${index}`] = {
      id: `badge-${index}`,
    };
  }
  return badges;
}

describe('SRS registry and validator', () => {
  it('tracks known SRS codes and category summary', () => {
    expect(SRS_REGISTRY['SRS-AGENT-001']).toBeDefined();
    expect(SRS_REGISTRY['SRS-COUNCIL-001']).toBeDefined();

    const summary = getSrsSummary();
    expect(summary.core).toBeGreaterThan(0);
    expect(summary.governance).toBeGreaterThan(0);
  });

  it('computes code coverage map', () => {
    const coverage = validateSrsCoverage(['SRS-AGENT-001', 'SRS-COUNCIL-001']);
    expect(coverage['SRS-AGENT-001']).toBe(true);
    expect(coverage['SRS-AUDIT-001']).toBe(false);
  });

  it('runs operational validation checks against an agent-like object', () => {
    const mockAgent = {
      interact: () => undefined,
      save_state: () => undefined,
      load_state: () => undefined,
      memory: {},
      _long_term_memory: { indexes: { primary: {} } },
      brotherhood: {
        total_xp: 1000,
        total_tp: 100,
        rank: 'artisan',
        streak: 7,
        RANK_THRESHOLDS: {
          initiate: 0,
          apprentice: 100,
          journeyman: 500,
          artisan: 1500,
          master: 5000,
          grandmaster: 15000,
          elder: 50000,
          legend: 100000,
        },
      },
      gamification: {
        BADGES: buildBadgeRecord(50),
      },
      _leaderboard_system: {},
      council: {
        submitDecision: () => undefined,
      },
      auditTrail: {},
      getChainHead: () => 'abc123',
    };

    const validator = new OperationalSRSValidator(mockAgent);
    const results = validator.validateAll();

    expect(results['SRS-AGENT-001'].satisfied).toBe(true);
    expect(results['SRS-BROTHER-001'].satisfied).toBe(true);
    expect(results['SRS-GAMIFY-001'].satisfied).toBe(true);

    const critical = validator.validateCritical();
    expect(critical.allPassed).toBe(false);
    expect(critical.failedCodes.length).toBeGreaterThan(0);

    const compliance = validator.getComplianceJson();
    expect(compliance.totalRequirements).toBe(Object.keys(results).length);
    expect(compliance.passed).toBeGreaterThan(0);
    expect(compliance.failed).toBeGreaterThan(0);
    expect(compliance.results.length).toBe(Object.keys(results).length);
  });
});