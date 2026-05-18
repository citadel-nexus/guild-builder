import { GameRank } from './models.js';

export type BadgeThreshold = {
  name: string;
  icon: string;
  threshold: number;
};

export type AwardResult = {
  baseXp: number;
  finalXp: number;
  rank: GameRank;
};

export class GamificationEngine {
  readonly xpThresholds: Record<GameRank, number> = {
    [GameRank.INITIATE]: 0,
    [GameRank.APPRENTICE]: 901,
    [GameRank.JOURNEYMAN]: 4429,
    [GameRank.EXPERT]: 13285,
    [GameRank.MASTER]: 40855,
    [GameRank.LEGEND]: 133428,
    [GameRank.ARCHITECT]: 500001,
    [GameRank.SAGE]: 2000001,
  };

  readonly rankMultipliers: Record<GameRank, number> = {
    [GameRank.INITIATE]: 1,
    [GameRank.APPRENTICE]: 1.25,
    [GameRank.JOURNEYMAN]: 1.5,
    [GameRank.EXPERT]: 1.75,
    [GameRank.MASTER]: 2,
    [GameRank.LEGEND]: 2.25,
    [GameRank.ARCHITECT]: 2.5,
    [GameRank.SAGE]: 3,
  };

  readonly badges: Record<string, BadgeThreshold>;

  constructor() {
    this.badges = this.initBadges();
  }

  awardXp(
    baseXp: number,
    rank: GameRank,
    multipliers: Record<string, number> = {},
  ): AwardResult {
    let finalXp = baseXp;
    finalXp = Math.floor(finalXp * (this.rankMultipliers[rank] ?? 1));
    for (const multiplier of Object.values(multipliers)) {
      finalXp = Math.floor(finalXp * multiplier);
    }
    return {
      baseXp,
      finalXp,
      rank,
    };
  }

  getCurrentRank(xpBalance: number): GameRank {
    const rankOrder: GameRank[] = [
      GameRank.SAGE,
      GameRank.ARCHITECT,
      GameRank.LEGEND,
      GameRank.MASTER,
      GameRank.EXPERT,
      GameRank.JOURNEYMAN,
      GameRank.APPRENTICE,
      GameRank.INITIATE,
    ];

    for (const rank of rankOrder) {
      if (xpBalance >= this.xpThresholds[rank]) {
        return rank;
      }
    }
    return GameRank.INITIATE;
  }

  getLevel(xpBalance: number): number {
    return Math.min(1 + Math.floor(xpBalance / 40000), 50);
  }

  private initBadges(): Record<string, BadgeThreshold> {
    return {
      first_memory: { name: 'Rememberer', icon: 'memory', threshold: 1 },
      tenth_memory: { name: 'Scholar', icon: 'scholar', threshold: 10 },
      fifty_memory: { name: 'Archivist', icon: 'archive', threshold: 50 },
      hundred_memory: { name: 'Omniscient', icon: 'omniscient', threshold: 100 },
      first_reflection: { name: 'Introspective', icon: 'reflection', threshold: 1 },
      rank_up: { name: 'Promoted', icon: 'promotion', threshold: 1 },
      perfect_coherence: {
        name: 'Harmonious',
        icon: 'coherence',
        threshold: 95,
      },
      xp_millionaire: {
        name: 'Legendary',
        icon: 'legendary',
        threshold: 1000000,
      },
    };
  }
}

export class GameificationEngine extends GamificationEngine {}