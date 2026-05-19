import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import type { BrotherhoodSystem } from "./brotherhood.js";

export enum ComprehensiveBadgeRarity {
  COMMON = "common",
  UNCOMMON = "uncommon",
  RARE = "rare",
  EPIC = "epic",
  LEGENDARY = "legendary",
  MYTHIC = "mythic",
}

export const COMPREHENSIVE_BADGE_RARITY_META: Record<
  ComprehensiveBadgeRarity,
  { description: string; multiplier: number; color: string }
> = {
  [ComprehensiveBadgeRarity.COMMON]: {
    description: "Common badges",
    multiplier: 1,
    color: "#808080",
  },
  [ComprehensiveBadgeRarity.UNCOMMON]: {
    description: "Uncommon badges",
    multiplier: 1.5,
    color: "#1EFF00",
  },
  [ComprehensiveBadgeRarity.RARE]: {
    description: "Rare badges",
    multiplier: 2,
    color: "#0070DD",
  },
  [ComprehensiveBadgeRarity.EPIC]: {
    description: "Epic badges",
    multiplier: 3,
    color: "#A335EE",
  },
  [ComprehensiveBadgeRarity.LEGENDARY]: {
    description: "Legendary badges",
    multiplier: 5,
    color: "#FF8000",
  },
  [ComprehensiveBadgeRarity.MYTHIC]: {
    description: "Mythic badges",
    multiplier: 10,
    color: "#E6CC80",
  },
};

export enum ComprehensiveAchievementCategory {
  INTERACTION = "interaction",
  LEARNING = "learning",
  EXPLORATION = "exploration",
  SOCIAL = "social",
  MASTERY = "mastery",
  DEDICATION = "dedication",
  SPECIAL = "special",
  SECRET = "secret",
}

export const COMPREHENSIVE_ACHIEVEMENT_CATEGORY_META: Record<
  ComprehensiveAchievementCategory,
  { description: string; icon: string }
> = {
  [ComprehensiveAchievementCategory.INTERACTION]: {
    description: "Conversation milestones",
    icon: "💬",
  },
  [ComprehensiveAchievementCategory.LEARNING]: {
    description: "Knowledge acquisition",
    icon: "📚",
  },
  [ComprehensiveAchievementCategory.EXPLORATION]: {
    description: "Discovery achievements",
    icon: "🔍",
  },
  [ComprehensiveAchievementCategory.SOCIAL]: {
    description: "Relationship milestones",
    icon: "🤝",
  },
  [ComprehensiveAchievementCategory.MASTERY]: {
    description: "Skill mastery",
    icon: "⭐",
  },
  [ComprehensiveAchievementCategory.DEDICATION]: {
    description: "Consistency achievements",
    icon: "🔥",
  },
  [ComprehensiveAchievementCategory.SPECIAL]: {
    description: "Unique achievements",
    icon: "✨",
  },
  [ComprehensiveAchievementCategory.SECRET]: {
    description: "Hidden achievements",
    icon: "🔮",
  },
};

export type CriteriaOperator = ">=" | "==" | "<=" | ">" | "<";

export class ComprehensiveAchievementCriteria {
  metric: string;
  operator: CriteriaOperator;
  value: number;
  description: string;

  constructor(input: {
    metric: string;
    operator: CriteriaOperator;
    value: number;
    description?: string;
  }) {
    this.metric = input.metric;
    this.operator = input.operator;
    this.value = input.value;
    this.description = input.description ?? "";
  }

  check(metrics: Record<string, number>): boolean {
    const current = metrics[this.metric] ?? 0;
    if (this.operator === ">=") {
      return current >= this.value;
    }
    if (this.operator === "==") {
      return current === this.value;
    }
    if (this.operator === "<=") {
      return current <= this.value;
    }
    if (this.operator === ">") {
      return current > this.value;
    }
    return current < this.value;
  }
}

export class ComprehensiveBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: ComprehensiveAchievementCategory;
  rarity: ComprehensiveBadgeRarity;
  criteria: ComprehensiveAchievementCriteria[];
  requiresAllCriteria: boolean;
  prerequisiteBadges: string[];
  xpReward: number;
  tpReward: number;
  skillUnlock?: string;
  titleUnlock?: string;
  featureUnlock?: string;
  flavorText?: string;
  unlockMessage?: string;
  imageUrl?: string;
  isUnlocked: boolean;
  unlockedAt?: string;
  isSecret: boolean;
  isRetired: boolean;
  progress: number;
  progressText?: string;

  constructor(input: {
    id?: string;
    name: string;
    description: string;
    icon?: string;
    category: ComprehensiveAchievementCategory;
    rarity?: ComprehensiveBadgeRarity;
    criteria?: ComprehensiveAchievementCriteria[];
    requiresAllCriteria?: boolean;
    prerequisiteBadges?: string[];
    xpReward?: number;
    tpReward?: number;
    skillUnlock?: string;
    titleUnlock?: string;
    featureUnlock?: string;
    flavorText?: string;
    unlockMessage?: string;
    imageUrl?: string;
    isUnlocked?: boolean;
    unlockedAt?: string;
    isSecret?: boolean;
    isRetired?: boolean;
    progress?: number;
    progressText?: string;
  }) {
    this.id = input.id ?? randomUUID();
    this.name = input.name;
    this.description = input.description;
    this.icon = input.icon ?? "🏅";
    this.category = input.category;
    this.rarity = input.rarity ?? ComprehensiveBadgeRarity.COMMON;
    this.criteria = [...(input.criteria ?? [])];
    this.requiresAllCriteria = input.requiresAllCriteria ?? true;
    this.prerequisiteBadges = [...(input.prerequisiteBadges ?? [])];
    this.xpReward = input.xpReward ?? 0;
    this.tpReward = input.tpReward ?? 0;
    this.skillUnlock = input.skillUnlock;
    this.titleUnlock = input.titleUnlock;
    this.featureUnlock = input.featureUnlock;
    this.flavorText = input.flavorText;
    this.unlockMessage = input.unlockMessage;
    this.imageUrl = input.imageUrl;
    this.isUnlocked = input.isUnlocked ?? false;
    this.unlockedAt = input.unlockedAt;
    this.isSecret = input.isSecret ?? false;
    this.isRetired = input.isRetired ?? false;
    this.progress = input.progress ?? 0;
    this.progressText = input.progressText;
  }

  checkCriteria(metrics: Record<string, number>): boolean {
    if (this.criteria.length === 0) {
      return false;
    }
    const checks = this.criteria.map((criterion) => criterion.check(metrics));
    return this.requiresAllCriteria ? checks.every(Boolean) : checks.some(Boolean);
  }
}

export type ComprehensiveAchievementSystemOptions = {
  storageDir?: string;
  brotherhood?: BrotherhoodSystem;
  now?: () => Date;
};

export class ComprehensiveAchievementSystem {
  private readonly storageDir: string;
  private readonly stateFile: string;
  private readonly logFile: string;
  private readonly now: () => Date;
  private readonly brotherhood?: BrotherhoodSystem;

  readonly badges = new Map<string, ComprehensiveBadge>();
  readonly badgeHistory: Array<Record<string, unknown>> = [];

  constructor(options: ComprehensiveAchievementSystemOptions = {}) {
    this.storageDir =
      options.storageDir ?? join(process.cwd(), ".nexus_cache", "badges-comprehensive");
    this.stateFile = join(this.storageDir, "badge_state.json");
    this.logFile = join(this.storageDir, "badge_log.jsonl");
    this.now = options.now ?? (() => new Date());
    this.brotherhood = options.brotherhood;
    mkdirSync(this.storageDir, { recursive: true });
    this.initializeBadges();
    this.loadState();
  }

  checkAndUnlock(metrics: Record<string, number>): ComprehensiveBadge[] {
    const unlocked: ComprehensiveBadge[] = [];
    for (const badge of this.badges.values()) {
      if (badge.isUnlocked || badge.isRetired) {
        continue;
      }
      const prerequisitesMet = badge.prerequisiteBadges.every(
        (badgeId) => this.badges.get(badgeId)?.isUnlocked === true,
      );
      if (!prerequisitesMet) {
        continue;
      }
      if (!badge.checkCriteria(metrics)) {
        continue;
      }

      badge.isUnlocked = true;
      badge.unlockedAt = this.now().toISOString();
      badge.progress = 100;
      unlocked.push(badge);

      const multiplier = COMPREHENSIVE_BADGE_RARITY_META[badge.rarity].multiplier;
      const xpAward = Math.floor(badge.xpReward * multiplier);
      const tpAward = Math.floor(badge.tpReward * multiplier);
      if (this.brotherhood && xpAward > 0) {
        this.brotherhood.awardXp("feat", {
          baseAmount: xpAward,
          reason: `Badge: ${badge.name}`,
        });
      }
      if (this.brotherhood && tpAward > 0) {
        this.brotherhood.totalTp += tpAward;
      }

      this.logBadgeEvent("unlocked", badge);
    }
    if (unlocked.length > 0) {
      this.saveState();
    }
    return unlocked;
  }

  updateProgress(metrics: Record<string, number>): void {
    for (const badge of this.badges.values()) {
      if (badge.isUnlocked || badge.criteria.length === 0) {
        continue;
      }
      const firstCriteria = badge.criteria[0];
      const current = metrics[firstCriteria.metric] ?? 0;
      const target = firstCriteria.value;
      badge.progress = target <= 0 ? 0 : Math.min(100, (current / target) * 100);
    }
    this.saveState();
  }

  getBadgeSummary(): Record<string, unknown> {
    const visibleBadges = [...this.badges.values()].filter(
      (badge) => !badge.isSecret || badge.isUnlocked,
    );
    const unlockedBadges = visibleBadges.filter((badge) => badge.isUnlocked);

    const byCategory: Record<string, { total: number; unlocked: number }> = {};
    for (const category of Object.values(ComprehensiveAchievementCategory)) {
      const categoryBadges = visibleBadges.filter(
        (badge) => badge.category === category,
      );
      byCategory[category] = {
        total: categoryBadges.length,
        unlocked: categoryBadges.filter((badge) => badge.isUnlocked).length,
      };
    }

    const byRarity: Record<string, { total: number; unlocked: number }> = {};
    for (const rarity of Object.values(ComprehensiveBadgeRarity)) {
      const rarityBadges = visibleBadges.filter((badge) => badge.rarity === rarity);
      byRarity[rarity] = {
        total: rarityBadges.length,
        unlocked: rarityBadges.filter((badge) => badge.isUnlocked).length,
      };
    }

    return {
      totalBadges: visibleBadges.length,
      unlockedBadges: unlockedBadges.length,
      completionPercentage:
        visibleBadges.length === 0
          ? 0
          : (unlockedBadges.length / visibleBadges.length) * 100,
      byCategory,
      byRarity,
      recentlyUnlocked: unlockedBadges
        .filter((badge) => badge.unlockedAt)
        .sort((left, right) =>
          (right.unlockedAt ?? "").localeCompare(left.unlockedAt ?? ""),
        )
        .slice(0, 5)
        .map((badge) => badge.name),
    };
  }

  getUnlockedBadges(): ComprehensiveBadge[] {
    return [...this.badges.values()].filter((badge) => badge.isUnlocked);
  }

  getAvailableBadges(): ComprehensiveBadge[] {
    return [...this.badges.values()].filter(
      (badge) => !badge.isUnlocked && !badge.isRetired && !badge.isSecret,
    );
  }

  private initializeBadges(): void {
    const register = (badge: ComprehensiveBadge): void => {
      this.badges.set(badge.id, badge);
    };

    register(
      new ComprehensiveBadge({
        id: "first_words",
        name: "First Words",
        description: "Complete your first interaction",
        icon: "👶",
        category: ComprehensiveAchievementCategory.INTERACTION,
        rarity: ComprehensiveBadgeRarity.COMMON,
        criteria: [
          new ComprehensiveAchievementCriteria({
            metric: "total_interactions",
            operator: ">=",
            value: 1,
          }),
        ],
        xpReward: 10,
        tpReward: 5,
      }),
    );
    register(
      new ComprehensiveBadge({
        id: "conversationalist",
        name: "Conversationalist",
        description: "Have 100 conversations",
        icon: "💬",
        category: ComprehensiveAchievementCategory.INTERACTION,
        rarity: ComprehensiveBadgeRarity.UNCOMMON,
        criteria: [
          new ComprehensiveAchievementCriteria({
            metric: "total_interactions",
            operator: ">=",
            value: 100,
          }),
        ],
        xpReward: 50,
        tpReward: 25,
      }),
    );
    register(
      new ComprehensiveBadge({
        id: "returning_friend",
        name: "Returning Friend",
        description: "Maintain a 3-day streak",
        icon: "📅",
        category: ComprehensiveAchievementCategory.DEDICATION,
        rarity: ComprehensiveBadgeRarity.COMMON,
        criteria: [
          new ComprehensiveAchievementCriteria({
            metric: "current_streak",
            operator: ">=",
            value: 3,
          }),
        ],
        xpReward: 25,
        tpReward: 10,
      }),
    );
    register(
      new ComprehensiveBadge({
        id: "dedicated",
        name: "Dedicated",
        description: "Maintain a 7-day streak",
        icon: "🔥",
        category: ComprehensiveAchievementCategory.DEDICATION,
        rarity: ComprehensiveBadgeRarity.UNCOMMON,
        criteria: [
          new ComprehensiveAchievementCriteria({
            metric: "current_streak",
            operator: ">=",
            value: 7,
          }),
        ],
        xpReward: 75,
        tpReward: 35,
      }),
    );
    register(
      new ComprehensiveBadge({
        id: "curious",
        name: "Curious",
        description: "Ask 10 questions",
        icon: "❓",
        category: ComprehensiveAchievementCategory.LEARNING,
        rarity: ComprehensiveBadgeRarity.COMMON,
        criteria: [
          new ComprehensiveAchievementCriteria({
            metric: "questions_asked",
            operator: ">=",
            value: 10,
          }),
        ],
        xpReward: 20,
        tpReward: 10,
      }),
    );
    register(
      new ComprehensiveBadge({
        id: "scholar",
        name: "Scholar",
        description: "Learn 50 facts",
        icon: "📖",
        category: ComprehensiveAchievementCategory.LEARNING,
        rarity: ComprehensiveBadgeRarity.RARE,
        criteria: [
          new ComprehensiveAchievementCriteria({
            metric: "facts_learned",
            operator: ">=",
            value: 50,
          }),
        ],
        xpReward: 200,
        tpReward: 100,
      }),
    );
    register(
      new ComprehensiveBadge({
        id: "explorer",
        name: "Explorer",
        description: "Explore 5 different topics",
        icon: "🗺️",
        category: ComprehensiveAchievementCategory.EXPLORATION,
        rarity: ComprehensiveBadgeRarity.COMMON,
        criteria: [
          new ComprehensiveAchievementCriteria({
            metric: "topics_explored",
            operator: ">=",
            value: 5,
          }),
        ],
        xpReward: 30,
        tpReward: 15,
      }),
    );
    register(
      new ComprehensiveBadge({
        id: "skill_starter",
        name: "Skill Starter",
        description: "Unlock your first skill",
        icon: "⭐",
        category: ComprehensiveAchievementCategory.MASTERY,
        rarity: ComprehensiveBadgeRarity.COMMON,
        criteria: [
          new ComprehensiveAchievementCriteria({
            metric: "skills_unlocked",
            operator: ">=",
            value: 1,
          }),
        ],
        xpReward: 25,
        tpReward: 10,
      }),
    );
    register(
      new ComprehensiveBadge({
        id: "skilled",
        name: "Skilled",
        description: "Unlock 10 skills",
        icon: "🌟",
        category: ComprehensiveAchievementCategory.MASTERY,
        rarity: ComprehensiveBadgeRarity.UNCOMMON,
        criteria: [
          new ComprehensiveAchievementCriteria({
            metric: "skills_unlocked",
            operator: ">=",
            value: 10,
          }),
        ],
        xpReward: 150,
        tpReward: 75,
      }),
    );
    register(
      new ComprehensiveBadge({
        id: "trusted",
        name: "Trusted",
        description: "Reach trust level 10",
        icon: "🤝",
        category: ComprehensiveAchievementCategory.SOCIAL,
        rarity: ComprehensiveBadgeRarity.COMMON,
        criteria: [
          new ComprehensiveAchievementCriteria({
            metric: "trust_score",
            operator: ">=",
            value: 10,
          }),
        ],
        xpReward: 50,
        tpReward: 25,
      }),
    );
    register(
      new ComprehensiveBadge({
        id: "night_owl",
        name: "Night Owl",
        description: "Have a conversation after midnight",
        icon: "🦉",
        category: ComprehensiveAchievementCategory.SPECIAL,
        rarity: ComprehensiveBadgeRarity.UNCOMMON,
        criteria: [
          new ComprehensiveAchievementCriteria({
            metric: "midnight_conversations",
            operator: ">=",
            value: 1,
          }),
        ],
        xpReward: 50,
        tpReward: 25,
      }),
    );
    register(
      new ComprehensiveBadge({
        id: "the_answer",
        name: "The Answer",
        description: "???",
        icon: "🔮",
        category: ComprehensiveAchievementCategory.SECRET,
        rarity: ComprehensiveBadgeRarity.MYTHIC,
        criteria: [
          new ComprehensiveAchievementCriteria({
            metric: "meaning_of_life",
            operator: "==",
            value: 42,
          }),
        ],
        xpReward: 4200,
        tpReward: 420,
        isSecret: true,
      }),
    );
  }

  private loadState(): void {
    if (!existsSync(this.stateFile)) {
      return;
    }
    try {
      const raw = readFileSync(this.stateFile, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.badges !== "object" || parsed.badges === null) {
        return;
      }
      for (const [badgeId, badgeValue] of Object.entries(parsed.badges)) {
        const badge = this.badges.get(badgeId);
        if (!badge || typeof badgeValue !== "object" || badgeValue === null) {
          continue;
        }
        const record = badgeValue as Record<string, unknown>;
        badge.isUnlocked = Boolean(record.isUnlocked);
        badge.unlockedAt =
          typeof record.unlockedAt === "string" ? record.unlockedAt : undefined;
        badge.progress =
          typeof record.progress === "number" && Number.isFinite(record.progress)
            ? record.progress
            : 0;
      }
    } catch {
      return;
    }
  }

  private saveState(): void {
    const badges = Object.fromEntries(
      [...this.badges.entries()].map(([badgeId, badge]) => [
        badgeId,
        {
          isUnlocked: badge.isUnlocked,
          unlockedAt: badge.unlockedAt,
          progress: badge.progress,
        },
      ]),
    );
    writeFileSync(this.stateFile, JSON.stringify({ badges }, null, 2), "utf8");
  }

  private logBadgeEvent(event: string, badge: ComprehensiveBadge): void {
    const entry = {
      timestamp: this.now().toISOString(),
      event,
      badgeId: badge.id,
      badgeName: badge.name,
      rarity: badge.rarity,
      xpReward: badge.xpReward,
      tpReward: badge.tpReward,
    };
    this.badgeHistory.push(entry);
    try {
      appendFileSync(this.logFile, `${JSON.stringify(entry)}\n`, "utf8");
    } catch {
      return;
    }
  }
}