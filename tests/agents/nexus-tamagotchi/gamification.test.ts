import { describe, expect, it } from 'vitest';

import {
  GameificationEngine,
  GamificationEngine,
} from '../../../src/agents/nexus-tamagotchi/gamification.js';
import { GameRank } from '../../../src/agents/nexus-tamagotchi/models.js';

describe('GamificationEngine', () => {
  it('applies rank and custom multipliers to XP awards', () => {
    const engine = new GamificationEngine();
    const result = engine.awardXp(100, GameRank.MASTER, { streak: 1.2 });
    expect(result.baseXp).toBe(100);
    expect(result.finalXp).toBeGreaterThan(100);
    expect(result.rank).toBe(GameRank.MASTER);
  });

  it('maps XP balances to rank thresholds', () => {
    const engine = new GamificationEngine();
    expect(engine.getCurrentRank(0)).toBe(GameRank.INITIATE);
    expect(engine.getCurrentRank(600000)).toBe(GameRank.ARCHITECT);
  });

  it('keeps typo-compatible engine alias available', () => {
    const engine = new GameificationEngine();
    expect(engine.getCurrentRank(1500000)).toBe(GameRank.ARCHITECT);
  });
});