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
});