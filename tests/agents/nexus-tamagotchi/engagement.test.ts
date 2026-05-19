import { describe, expect, it } from 'vitest';

import { ZayaraEngagementEngine } from '../../../src/agents/nexus-tamagotchi/engagement.js';
import { GameRank } from '../../../src/agents/nexus-tamagotchi/models.js';

describe('ZayaraEngagementEngine', () => {
  it('builds rank promotion messages with unlocked capabilities', () => {
    const engine = new ZayaraEngagementEngine();
    const message = engine.generatePromotionMessage(
      GameRank.INITIATE,
      GameRank.APPRENTICE,
      800,
    );
    expect(message).toContain('RANK PROMOTION');
    expect(message).toContain('New capabilities unlocked');
  });

  it('calculates xp progress and next rank', () => {
    const engine = new ZayaraEngagementEngine();
    const progress = engine.getXpProgress(GameRank.APPRENTICE, 900);
    expect(progress.progress).toBeGreaterThan(0);
    expect(progress.nextRank).toBe(GameRank.JOURNEYMAN);
  });
});