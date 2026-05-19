import { BrotherhoodSystem } from "./brotherhood.js";
import { BADGE_REGISTRY } from "./data/badges.js";
import { GameRank } from "./models.js";
import type { Badge } from "./types.js";

export type BadgeUnlockRecord = {
  id: string;
  name: string;
  description: string;
  category: Badge["category"];
  xpReward: number;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
};

export type BadgeConditionStats = {
  interactions?: number;
  memoriesStored?: number;
  missionsCompleted?: number;
  rank?: GameRank;
  allEpicQuestsCompleted?: boolean;
};

const RANK_BADGE_MAP: Partial<Record<GameRank, string>> = {
  [GameRank.APPRENTICE]: "economy.rank_apprentice",
  [GameRank.MASTER]: "economy.rank_master",
  [GameRank.LEGEND]: "economy.rank_legend",
};

export class BadgeSystem {
  readonly unlockedBadges = new Map<string, BadgeUnlockRecord>();

  constructor(private readonly brotherhood: BrotherhoodSystem) {}

  checkUnlock(
    badgeId: string,
    conditionMet: boolean,
  ): BadgeUnlockRecord | undefined {
    if (!conditionMet || this.unlockedBadges.has(badgeId)) {
      return undefined;
    }

    const badge = BADGE_REGISTRY[badgeId];
    if (!badge) {
      return undefined;
    }

    const unlocked: BadgeUnlockRecord = {
      id: badge.id,
      name: badge.name,
      description: badge.description,
      category: badge.category,
      xpReward: badge.xpReward,
      icon: badge.icon,
      unlocked: true,
      unlockedAt: new Date().toISOString(),
    };

    this.unlockedBadges.set(badgeId, unlocked);
    this.brotherhood.awardXp("feat", {
      baseAmount: badge.xpReward,
      reason: `Badge: ${badge.name}`,
    });
    return unlocked;
  }

  checkAllConditions(stats: BadgeConditionStats): BadgeUnlockRecord[] {
    const newlyUnlocked: BadgeUnlockRecord[] = [];

    const checks: Array<{ badgeId: string; condition: boolean }> = [
      {
        badgeId: "interaction.first_contact",
        condition: (stats.interactions ?? 0) >= 1,
      },
      {
        badgeId: "interaction.question_master",
        condition: (stats.interactions ?? 0) >= 100,
      },
      {
        badgeId: "interaction.dialogue_architect",
        condition: (stats.interactions ?? 0) >= 500,
      },
      {
        badgeId: "memory.seeded_archive",
        condition: (stats.memoriesStored ?? 0) >= 1,
      },
      {
        badgeId: "memory.archivist",
        condition: (stats.memoriesStored ?? 0) >= 100,
      },
      {
        badgeId: "autonomy.mission_engineer",
        condition: (stats.missionsCompleted ?? 0) >= 100,
      },
    ];

    for (const check of checks) {
      const unlocked = this.checkUnlock(check.badgeId, check.condition);
      if (unlocked) {
        newlyUnlocked.push(unlocked);
      }
    }

    if (stats.rank) {
      const rankBadgeId = RANK_BADGE_MAP[stats.rank];
      if (rankBadgeId) {
        const unlocked = this.checkUnlock(rankBadgeId, true);
        if (unlocked) {
          newlyUnlocked.push(unlocked);
        }
      }
    }

    if (stats.rank === GameRank.LEGEND && stats.allEpicQuestsCompleted) {
      const unlocked = this.checkUnlock("special.nexus_legend", true);
      if (unlocked) {
        newlyUnlocked.push(unlocked);
      }
    }

    return newlyUnlocked;
  }

  getUnlockedCount(): number {
    return this.unlockedBadges.size;
  }

  getTotalCount(): number {
    return Object.keys(BADGE_REGISTRY).length;
  }

  getUnlockedBadgeIds(): string[] {
    return [...this.unlockedBadges.keys()];
  }
}
