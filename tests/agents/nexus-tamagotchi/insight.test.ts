import { describe, expect, it } from 'vitest';

import { BrotherhoodSystem } from '../../../src/agents/nexus-tamagotchi/brotherhood.js';
import { InsightEngine } from '../../../src/agents/nexus-tamagotchi/insight.js';
import { NexusAgentVitals } from '../../../src/agents/nexus-tamagotchi/models.js';

describe('InsightEngine', () => {
  it('generates insights from interaction patterns', () => {
    const brotherhood = new BrotherhoodSystem('agent-insight');
    const engine = new InsightEngine(brotherhood);

    const insights = engine.analyzeInteractionPatterns(
      new Array(12).fill({ metric: 'interaction' }),
    );
    expect(insights.length).toBeGreaterThan(0);
    expect(engine.insights.length).toBe(insights.length);
  });

  it('suggests growth areas from vitals and skill count', () => {
    const brotherhood = new BrotherhoodSystem('agent-insight-2');
    const engine = new InsightEngine(brotherhood);
    const vitals = new NexusAgentVitals({
      energyLevel: 0.2,
    });

    const suggestions = engine.suggestGrowthAreas(vitals, 1);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((item) => item.area === 'Energy')).toBe(true);
  });

  it('generates weekly report from interaction history', () => {
    const brotherhood = new BrotherhoodSystem('agent-insight-3');
    const engine = new InsightEngine(brotherhood);
    const interactions = new Array(6).fill({ event: 'interaction' });

    const report = engine.generateWeeklyReport(interactions, 120, 12, 1);
    expect(report.interactions).toBe(6);
    expect(report.xpEarned).toBe(120);
    expect(report.tpEarned).toBe(12);
    expect(report.rankChanges).toBe(1);
    expect(engine.reports.length).toBe(1);
  });
});