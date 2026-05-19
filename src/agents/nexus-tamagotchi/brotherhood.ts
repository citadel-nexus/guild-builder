import { GameRank } from './models.js';

export type BrotherhoodActivityType =
  | 'feat'
  | 'fix'
  | 'refactor'
  | 'docs'
  | 'test'
  | 'chore'
  | 'interaction'
  | 'reflection';

export type BrotherhoodAwardResult = {
  xpEarned: number;
  tpEarned: number;
  totalXp: number;
  totalTp: number;
  rank: GameRank;
  rankUp: boolean;
  rankUpMessage?: string;
};

export type BrotherhoodStats = {
  agentId: string;
  totalXp: number;
  totalTp: number;
  rank: GameRank;
  streakDays: number;
};

const XP_VALUES: Record<BrotherhoodActivityType, number> = {
  feat: 50,
  fix: 30,
  refactor: 25,
  docs: 15,
  test: 20,
  chore: 10,
  interaction: 15,
  reflection: 25,
};

const RANK_THRESHOLDS: Array<{ rank: GameRank; minimumXp: number }> = [
  { rank: GameRank.SAGE, minimumXp: 2_000_001 },
  { rank: GameRank.ARCHITECT, minimumXp: 500_001 },
  { rank: GameRank.LEGEND, minimumXp: 133_428 },
  { rank: GameRank.MASTER, minimumXp: 40_855 },
  { rank: GameRank.EXPERT, minimumXp: 13_285 },
  { rank: GameRank.JOURNEYMAN, minimumXp: 4_429 },
  { rank: GameRank.APPRENTICE, minimumXp: 901 },
  { rank: GameRank.INITIATE, minimumXp: 0 },
];

export class BrotherhoodSystem {
  totalXp = 0;
  totalTp = 0;
  rank: GameRank = GameRank.INITIATE;
  streakDays = 0;
  lastActivity = new Date().toISOString();

  constructor(readonly agentId: string) {}

  get currentRank(): GameRank {
    return this.rank;
  }

  awardXp(
    activityType: BrotherhoodActivityType,
    options: {
      baseAmount?: number;
      reason?: string;
    } = {},
  ): BrotherhoodAwardResult {
    const xpEarned = options.baseAmount ?? XP_VALUES[activityType] ?? 10;
    const previousRank = this.rank;

    this.totalXp += xpEarned;
    this.rank = this.calculateRank(this.totalXp);

    const tpEarned = Math.max(1, Math.floor(xpEarned / 10));
    this.totalTp += tpEarned;
    this.lastActivity = new Date().toISOString();

    const rankUp = previousRank !== this.rank;
    return {
      xpEarned,
      tpEarned,
      totalXp: this.totalXp,
      totalTp: this.totalTp,
      rank: this.rank,
      rankUp,
      rankUpMessage: rankUp ? `Ranked up to ${this.rank}!` : undefined,
    };
  }

  setStreakDays(days: number): void {
    this.streakDays = Math.max(0, Math.floor(days));
  }

  getStats(): BrotherhoodStats {
    return {
      agentId: this.agentId,
      totalXp: this.totalXp,
      totalTp: this.totalTp,
      rank: this.rank,
      streakDays: this.streakDays,
    };
  }

  private calculateRank(xp: number): GameRank {
    for (const threshold of RANK_THRESHOLDS) {
      if (xp >= threshold.minimumXp) {
        return threshold.rank;
      }
    }
    return GameRank.INITIATE;
  }
}