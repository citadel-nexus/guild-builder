import { describe, expect, it } from 'vitest';

import {
  BrotherhoodSystem,
} from '../../../src/agents/nexus-tamagotchi/brotherhood.js';
import { GameRank } from '../../../src/agents/nexus-tamagotchi/models.js';

describe('BrotherhoodSystem', () => {
  it('awards xp/tp and updates rank thresholds', () => {
    const brotherhood = new BrotherhoodSystem('agent-1');
    const result = brotherhood.awardXp('feat', { baseAmount: 1000 });

    expect(result.xpEarned).toBe(1000);
    expect(result.tpEarned).toBeGreaterThan(0);
    expect(result.rank).toBe(GameRank.APPRENTICE);
    expect(result.rankUp).toBe(true);
  });

  it('returns immutable stats snapshot', () => {
    const brotherhood = new BrotherhoodSystem('agent-2');
    brotherhood.awardXp('interaction');
    const stats = brotherhood.getStats();
    expect(stats.agentId).toBe('agent-2');
    expect(stats.totalXp).toBeGreaterThan(0);
    expect(stats.rank).toBe(GameRank.INITIATE);
  });
});