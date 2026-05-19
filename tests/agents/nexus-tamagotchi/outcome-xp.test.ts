import { describe, expect, it } from 'vitest';

import { OutcomeXPEngine } from '../../../src/agents/nexus-tamagotchi/outcome-xp.js';

describe('OutcomeXPEngine', () => {
  it('scores interaction and applies bounded multipliers', () => {
    const engine = new OutcomeXPEngine();
    const score = engine.scoreInteraction('interaction-1', 100, {
      coherence: 0.9,
      session_duration: 0.9,
      is_returning_user: 1,
      satisfaction: 0.8,
      errors: 0,
    });

    expect(score.finalXp).toBeGreaterThan(0);
    expect(score.multiplier).toBeGreaterThanOrEqual(0.5);
    expect(score.multiplier).toBeLessThanOrEqual(2);
  });

  it('reports average multiplier', () => {
    const engine = new OutcomeXPEngine();
    engine.scoreInteraction('i1', 20);
    engine.scoreInteraction('i2', 20);
    expect(engine.getAverageMultiplier()).toBeGreaterThan(0);
  });
});