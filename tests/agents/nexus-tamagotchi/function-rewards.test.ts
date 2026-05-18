import { describe, expect, it } from 'vitest';

import {
  FunctionRewardsMap,
} from '../../../src/agents/nexus-tamagotchi/function-rewards.js';

describe('FunctionRewardsMap', () => {
  it('awards configured rewards with multipliers', () => {
    const rewards = new FunctionRewardsMap();
    const result = rewards.getReward('interact', {
      streakDays: 3,
      firstOfDay: true,
    });

    expect(result.awarded).toBe(true);
    expect(result.xp).toBeGreaterThan(15);
    expect(result.tp).toBeGreaterThan(5);
  });

  it('returns unknown-function guard response', () => {
    const rewards = new FunctionRewardsMap();
    const result = rewards.getReward('missing_function');
    expect(result.awarded).toBe(false);
    expect(result.reason).toContain('Unknown');
  });
});