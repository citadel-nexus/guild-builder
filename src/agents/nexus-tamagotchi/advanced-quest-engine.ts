import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import type { BrotherhoodSystem } from "./brotherhood.js";
import type { SkillTracker } from "./skill-tracker.js";
import type { SkillTreeSystem } from "./skill-tree-system.js";

export enum QuestDifficulty {
  TRIVIAL = "trivial",
  EASY = "easy",
  NORMAL = "normal",
  HARD = "hard",
  HEROIC = "heroic",
  LEGENDARY = "legendary",
  MYTHIC = "mythic",
}

export const QUEST_DIFFICULTY_MULTIPLIER: Record<QuestDifficulty, number> = {
  [QuestDifficulty.TRIVIAL]: 0.5,
  [QuestDifficulty.EASY]: 1,
  [QuestDifficulty.NORMAL]: 1.5,
  [QuestDifficulty.HARD]: 2,
  [QuestDifficulty.HEROIC]: 3,
  [QuestDifficulty.LEGENDARY]: 5,
  [QuestDifficulty.MYTHIC]: 10,
};

export enum QuestType {
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  STORY = "story",
  SIDE = "side",
  REPEATABLE = "repeatable",
  CHAIN = "chain",
  EVENT = "event",
  HIDDEN = "hidden",
}

export const QUEST_TYPE_RESET_HOURS: Partial<Record<QuestType, number>> = {
  [QuestType.DAILY]: 24,
  [QuestType.WEEKLY]: 168,
  [QuestType.MONTHLY]: 720,
};

export enum QuestStatus {
  LOCKED = "locked",
  AVAILABLE = "available",
  ACTIVE = "active",
  COMPLETED = "completed",
  CLAIMED = "claimed",
  FAILED = "failed",
  EXPIRED = "expired",
}

export class QuestObjective {
  readonly id: string;
  description: string;
  objectiveType: "count" | "unique" | "threshold" | "duration";
  targetValue: number;
  currentValue: number;
  targetMetric: string;
  isOptional: boolean;
  isHidden: boolean;
  hint?: string;
  metadata: Record<string, unknown>;

  constructor(input: {
    id?: string;
    description: string;
    objectiveType?: "count" | "unique" | "threshold" | "duration";
    targetValue?: number;
    currentValue?: number;
    targetMetric: string;
    isOptional?: boolean;
    isHidden?: boolean;
    hint?: string;
    metadata?: Record<string, unknown>;
  }) {
    this.id = input.id ?? randomUUID();
    this.description = input.description;
    this.objectiveType = input.objectiveType ?? "count";
    this.targetValue = input.targetValue ?? 1;
    this.currentValue = input.currentValue ?? 0;
    this.targetMetric = input.targetMetric;
    this.isOptional = input.isOptional ?? false;
    this.isHidden = input.isHidden ?? false;
    this.hint = input.hint;
    this.metadata = { ...(input.metadata ?? {}) };
  }

  get isComplete(): boolean {
    return this.currentValue >= this.targetValue;
  }

  get progressPercentage(): number {
    if (this.targetValue <= 0) {
      return 100;
    }
    return Math.min(100, (this.currentValue / this.targetValue) * 100);
  }

  increment(amount = 1): boolean {
    const wasComplete = this.isComplete;
    this.currentValue = Math.min(this.currentValue + amount, this.targetValue);
    return !wasComplete && this.isComplete;
  }

  toDict(): Record<string, unknown> {
    return {
      id: this.id,
      description: this.description,
      objectiveType: this.objectiveType,
      targetValue: this.targetValue,
      currentValue: this.currentValue,
      targetMetric: this.targetMetric,
      isOptional: this.isOptional,
      isHidden: this.isHidden,
      hint: this.hint,
      metadata: { ...this.metadata },
    };
  }

  static fromDict(value: unknown): QuestObjective | undefined {
    if (typeof value !== "object" || value === null) {
      return undefined;
    }
    const record = value as Record<string, unknown>;
    const description =
      typeof record.description === "string" ? record.description : "";
    const targetMetric =
      typeof record.targetMetric === "string" ? record.targetMetric : "";
    if (!description || !targetMetric) {
      return undefined;
    }
    return new QuestObjective({
      id: typeof record.id === "string" ? record.id : undefined,
      description,
      objectiveType:
        record.objectiveType === "unique" ||
        record.objectiveType === "threshold" ||
        record.objectiveType === "duration" ||
        record.objectiveType === "count"
          ? record.objectiveType
          : "count",
      targetValue:
        typeof record.targetValue === "number" ? record.targetValue : 1,
      currentValue:
        typeof record.currentValue === "number" ? record.currentValue : 0,
      targetMetric,
      isOptional: Boolean(record.isOptional),
      isHidden: Boolean(record.isHidden),
      hint: typeof record.hint === "string" ? record.hint : undefined,
      metadata:
        typeof record.metadata === "object" && record.metadata
          ? (record.metadata as Record<string, unknown>)
          : {},
    });
  }
}

export class QuestReward {
  xp: number;
  tp: number;
  badges: string[];
  skillsUnlocked: string[];
  items: string[];
  titles: string[];
  customRewards: Record<string, unknown>;
  bonusMultiplier: number;

  constructor(input: Partial<QuestReward> = {}) {
    this.xp = input.xp ?? 0;
    this.tp = input.tp ?? 0;
    this.badges = [...(input.badges ?? [])];
    this.skillsUnlocked = [...(input.skillsUnlocked ?? [])];
    this.items = [...(input.items ?? [])];
    this.titles = [...(input.titles ?? [])];
    this.customRewards = { ...(input.customRewards ?? {}) };
    this.bonusMultiplier = input.bonusMultiplier ?? 1;
  }

  get totalXp(): number {
    return Math.floor(this.xp * this.bonusMultiplier);
  }

  get totalTp(): number {
    return Math.floor(this.tp * this.bonusMultiplier);
  }

  toDict(): Record<string, unknown> {
    return {
      xp: this.xp,
      tp: this.tp,
      badges: [...this.badges],
      skillsUnlocked: [...this.skillsUnlocked],
      items: [...this.items],
      titles: [...this.titles],
      customRewards: { ...this.customRewards },
      bonusMultiplier: this.bonusMultiplier,
    };
  }

  static fromDict(value: unknown): QuestReward {
    if (typeof value !== "object" || value === null) {
      return new QuestReward();
    }
    const record = value as Record<string, unknown>;
    return new QuestReward({
      xp: typeof record.xp === "number" ? record.xp : 0,
      tp: typeof record.tp === "number" ? record.tp : 0,
      badges: Array.isArray(record.badges)
        ? record.badges.filter((item): item is string => typeof item === "string")
        : [],
      skillsUnlocked: Array.isArray(record.skillsUnlocked)
        ? record.skillsUnlocked.filter(
            (item): item is string => typeof item === "string",
          )
        : [],
      items: Array.isArray(record.items)
        ? record.items.filter((item): item is string => typeof item === "string")
        : [],
      titles: Array.isArray(record.titles)
        ? record.titles.filter((item): item is string => typeof item === "string")
        : [],
      customRewards:
        typeof record.customRewards === "object" && record.customRewards
          ? (record.customRewards as Record<string, unknown>)
          : {},
      bonusMultiplier:
        typeof record.bonusMultiplier === "number" ? record.bonusMultiplier : 1,
    });
  }
}

export class Quest {
  id: string;
  name: string;
  description: string;
  questType: QuestType;
  difficulty: QuestDifficulty;
  status: QuestStatus;
  objectives: QuestObjective[];
  reward: QuestReward;
  requiredLevel: number;
  requiredXp: number;
  requiredQuests: string[];
  requiredBadges: string[];
  requiredSkills: string[];
  createdAt: string;
  acceptedAt?: string;
  completedAt?: string;
  expiresAt?: string;
  chainId?: string;
  chainIndex: number;
  nextQuestId?: string;
  category: string;
  tags: string[];
  icon: string;
  flavorText?: string;
  completionMessage?: string;
  metadata: Record<string, unknown>;

  constructor(input: {
    id?: string;
    name: string;
    description: string;
    questType?: QuestType;
    difficulty?: QuestDifficulty;
    status?: QuestStatus;
    objectives?: QuestObjective[];
    reward?: QuestReward;
    requiredLevel?: number;
    requiredXp?: number;
    requiredQuests?: string[];
    requiredBadges?: string[];
    requiredSkills?: string[];
    createdAt?: string;
    acceptedAt?: string;
    completedAt?: string;
    expiresAt?: string;
    chainId?: string;
    chainIndex?: number;
    nextQuestId?: string;
    category?: string;
    tags?: string[];
    icon?: string;
    flavorText?: string;
    completionMessage?: string;
    metadata?: Record<string, unknown>;
  }) {
    this.id = input.id ?? randomUUID();
    this.name = input.name;
    this.description = input.description;
    this.questType = input.questType ?? QuestType.SIDE;
    this.difficulty = input.difficulty ?? QuestDifficulty.NORMAL;
    this.status = input.status ?? QuestStatus.AVAILABLE;
    this.objectives = [...(input.objectives ?? [])];
    this.reward = input.reward ?? new QuestReward();
    this.requiredLevel = input.requiredLevel ?? 0;
    this.requiredXp = input.requiredXp ?? 0;
    this.requiredQuests = [...(input.requiredQuests ?? [])];
    this.requiredBadges = [...(input.requiredBadges ?? [])];
    this.requiredSkills = [...(input.requiredSkills ?? [])];
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.acceptedAt = input.acceptedAt;
    this.completedAt = input.completedAt;
    this.expiresAt = input.expiresAt;
    this.chainId = input.chainId;
    this.chainIndex = input.chainIndex ?? 0;
    this.nextQuestId = input.nextQuestId;
    this.category = input.category ?? "general";
    this.tags = [...(input.tags ?? [])];
    this.icon = input.icon ?? "📜";
    this.flavorText = input.flavorText;
    this.completionMessage = input.completionMessage;
    this.metadata = { ...(input.metadata ?? {}) };
  }

  get isComplete(): boolean {
    const required = this.objectives.filter((objective) => !objective.isOptional);
    return required.every((objective) => objective.isComplete);
  }

  get progressPercentage(): number {
    const required = this.objectives.filter((objective) => !objective.isOptional);
    if (required.length === 0) {
      return 100;
    }
    return (
      required.reduce(
        (total, objective) => total + objective.progressPercentage,
        0,
      ) / required.length
    );
  }

  get isExpired(): boolean {
    if (!this.expiresAt) {
      return false;
    }
    return Date.now() > Date.parse(this.expiresAt);
  }

  canAccept(input: {
    userXp: number;
    userLevel: number;
    completedQuests: string[];
    userBadges: string[];
    userSkills: string[];
  }): { allowed: boolean; reason: string } {
    if (this.status !== QuestStatus.AVAILABLE) {
      return { allowed: false, reason: `Quest status is ${this.status}` };
    }
    if (input.userXp < this.requiredXp) {
      return {
        allowed: false,
        reason: `Requires ${this.requiredXp} XP (current ${input.userXp})`,
      };
    }
    if (input.userLevel < this.requiredLevel) {
      return {
        allowed: false,
        reason: `Requires level ${this.requiredLevel}`,
      };
    }
    const missingQuests = this.requiredQuests.filter(
      (questId) => !input.completedQuests.includes(questId),
    );
    if (missingQuests.length > 0) {
      return {
        allowed: false,
        reason: `Requires quests: ${missingQuests.join(", ")}`,
      };
    }
    const missingBadges = this.requiredBadges.filter(
      (badge) => !input.userBadges.includes(badge),
    );
    if (missingBadges.length > 0) {
      return {
        allowed: false,
        reason: `Requires badges: ${missingBadges.join(", ")}`,
      };
    }
    const missingSkills = this.requiredSkills.filter(
      (skill) => !input.userSkills.includes(skill),
    );
    if (missingSkills.length > 0) {
      return {
        allowed: false,
        reason: `Requires skills: ${missingSkills.join(", ")}`,
      };
    }
    if (this.isExpired) {
      return { allowed: false, reason: "Quest has expired" };
    }
    return { allowed: true, reason: "Quest can be accepted" };
  }

  toDict(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      questType: this.questType,
      difficulty: this.difficulty,
      status: this.status,
      objectives: this.objectives.map((objective) => objective.toDict()),
      reward: this.reward.toDict(),
      requiredLevel: this.requiredLevel,
      requiredXp: this.requiredXp,
      requiredQuests: [...this.requiredQuests],
      requiredBadges: [...this.requiredBadges],
      requiredSkills: [...this.requiredSkills],
      createdAt: this.createdAt,
      acceptedAt: this.acceptedAt,
      completedAt: this.completedAt,
      expiresAt: this.expiresAt,
      chainId: this.chainId,
      chainIndex: this.chainIndex,
      nextQuestId: this.nextQuestId,
      category: this.category,
      tags: [...this.tags],
      icon: this.icon,
      flavorText: this.flavorText,
      completionMessage: this.completionMessage,
      metadata: { ...this.metadata },
    };
  }

  static fromDict(value: unknown): Quest | undefined {
    if (typeof value !== "object" || value === null) {
      return undefined;
    }
    const record = value as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name : "";
    const description =
      typeof record.description === "string" ? record.description : "";
    if (!name || !description) {
      return undefined;
    }
    const objectives = Array.isArray(record.objectives)
      ? record.objectives
          .map((objective) => QuestObjective.fromDict(objective))
          .filter((objective): objective is QuestObjective => Boolean(objective))
      : [];
    const questType =
      typeof record.questType === "string" &&
      Object.values(QuestType).includes(record.questType as QuestType)
        ? (record.questType as QuestType)
        : QuestType.SIDE;
    const difficulty =
      typeof record.difficulty === "string" &&
      Object.values(QuestDifficulty).includes(record.difficulty as QuestDifficulty)
        ? (record.difficulty as QuestDifficulty)
        : QuestDifficulty.NORMAL;
    const status =
      typeof record.status === "string" &&
      Object.values(QuestStatus).includes(record.status as QuestStatus)
        ? (record.status as QuestStatus)
        : QuestStatus.AVAILABLE;
    return new Quest({
      id: typeof record.id === "string" ? record.id : undefined,
      name,
      description,
      questType,
      difficulty,
      status,
      objectives,
      reward: QuestReward.fromDict(record.reward),
      requiredLevel:
        typeof record.requiredLevel === "number" ? record.requiredLevel : 0,
      requiredXp: typeof record.requiredXp === "number" ? record.requiredXp : 0,
      requiredQuests: Array.isArray(record.requiredQuests)
        ? record.requiredQuests.filter((item): item is string => typeof item === "string")
        : [],
      requiredBadges: Array.isArray(record.requiredBadges)
        ? record.requiredBadges.filter((item): item is string => typeof item === "string")
        : [],
      requiredSkills: Array.isArray(record.requiredSkills)
        ? record.requiredSkills.filter((item): item is string => typeof item === "string")
        : [],
      createdAt:
        typeof record.createdAt === "string"
          ? record.createdAt
          : new Date().toISOString(),
      acceptedAt: typeof record.acceptedAt === "string" ? record.acceptedAt : undefined,
      completedAt:
        typeof record.completedAt === "string" ? record.completedAt : undefined,
      expiresAt: typeof record.expiresAt === "string" ? record.expiresAt : undefined,
      chainId: typeof record.chainId === "string" ? record.chainId : undefined,
      chainIndex: typeof record.chainIndex === "number" ? record.chainIndex : 0,
      nextQuestId:
        typeof record.nextQuestId === "string" ? record.nextQuestId : undefined,
      category: typeof record.category === "string" ? record.category : "general",
      tags: Array.isArray(record.tags)
        ? record.tags.filter((item): item is string => typeof item === "string")
        : [],
      icon: typeof record.icon === "string" ? record.icon : "📜",
      flavorText:
        typeof record.flavorText === "string" ? record.flavorText : undefined,
      completionMessage:
        typeof record.completionMessage === "string"
          ? record.completionMessage
          : undefined,
      metadata:
        typeof record.metadata === "object" && record.metadata
          ? (record.metadata as Record<string, unknown>)
          : {},
    });
  }
}

export type QuestChain = {
  id: string;
  name: string;
  description: string;
  questIds: string[];
  currentIndex: number;
  totalReward: QuestReward;
  isComplete: boolean;
  category: string;
  icon: string;
};

type QuestTemplateDefinition = {
  name: string;
  description: string;
  objectives: Array<{
    type: QuestObjective["objectiveType"];
    metric: string;
    target: string;
  }>;
  reward: { xp: number; tp: number; badges?: string[] };
  difficulty: QuestDifficulty;
  variables?: Record<string, number[]>;
};

function randomPick<T>(items: T[]): T | undefined {
  if (items.length === 0) {
    return undefined;
  }
  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

function parseTarget(value: string, variables: Record<string, number>): number {
  if (value.includes("{") && value.includes("}")) {
    const resolved = value.replace(/\{([^}]+)\}/g, (_, key: string) =>
      String(variables[key] ?? 0),
    );
    return Number.parseInt(resolved, 10);
  }
  return Number.parseInt(value, 10);
}

export class QuestTemplate {
  static readonly DAILY_TEMPLATES: QuestTemplateDefinition[] = [
    {
      name: "Conversation Starter",
      description: "Have {count} conversations with the agent",
      objectives: [{ type: "count", metric: "interactions", target: "{count}" }],
      reward: { xp: 50, tp: 10 },
      difficulty: QuestDifficulty.EASY,
      variables: { count: [3, 5, 7, 10] },
    },
    {
      name: "Knowledge Seeker",
      description: "Learn {count} new facts",
      objectives: [{ type: "count", metric: "facts_learned", target: "{count}" }],
      reward: { xp: 100, tp: 20 },
      difficulty: QuestDifficulty.NORMAL,
      variables: { count: [1, 3, 5] },
    },
    {
      name: "Diverse Explorer",
      description: "Discuss {count} different topics",
      objectives: [
        { type: "unique", metric: "topics_discussed", target: "{count}" },
      ],
      reward: { xp: 80, tp: 16 },
      difficulty: QuestDifficulty.NORMAL,
      variables: { count: [3, 5, 7] },
    },
  ];

  static readonly WEEKLY_TEMPLATES: QuestTemplateDefinition[] = [
    {
      name: "Dedicated Companion",
      description: "Have {count} interactions this week",
      objectives: [
        { type: "count", metric: "weekly_interactions", target: "{count}" },
      ],
      reward: { xp: 300, tp: 60 },
      difficulty: QuestDifficulty.NORMAL,
      variables: { count: [20, 35, 50] },
    },
    {
      name: "Badge Hunter",
      description: "Earn {count} badges",
      objectives: [{ type: "count", metric: "badges_earned", target: "{count}" }],
      reward: { xp: 350, tp: 70 },
      difficulty: QuestDifficulty.HARD,
      variables: { count: [1, 2, 3] },
    },
  ];

  static generateDailyQuests(count = 3, userLevel = 1): Quest[] {
    const templates = [...QuestTemplate.DAILY_TEMPLATES].slice(
      0,
      Math.max(1, count),
    );
    return templates.map((template) =>
      QuestTemplate.buildQuest(template, QuestType.DAILY, userLevel, 24),
    );
  }

  static generateWeeklyQuests(count = 2, userLevel = 1): Quest[] {
    const templates = [...QuestTemplate.WEEKLY_TEMPLATES].slice(
      0,
      Math.max(1, count),
    );
    return templates.map((template) =>
      QuestTemplate.buildQuest(template, QuestType.WEEKLY, userLevel, 168),
    );
  }

  private static buildQuest(
    template: QuestTemplateDefinition,
    questType: QuestType,
    userLevel: number,
    expiryHours: number,
  ): Quest {
    const variables: Record<string, number> = {};
    for (const [key, options] of Object.entries(template.variables ?? {})) {
      const scale = Math.max(1, Math.floor(userLevel / 5) + 1);
      const selectedOptions = options.slice(0, Math.min(options.length, scale));
      variables[key] = randomPick(selectedOptions) ?? options[0] ?? 1;
    }
    const objectives = template.objectives.map(
      (objective) =>
        new QuestObjective({
          description: fillQuestTemplate(template.description, variables),
          objectiveType: objective.type,
          targetMetric: objective.metric,
          targetValue: parseTarget(objective.target, variables),
        }),
    );
    return new Quest({
      name: template.name,
      description: fillQuestTemplate(template.description, variables),
      questType,
      difficulty: template.difficulty,
      objectives,
      reward: new QuestReward({
        xp: template.reward.xp,
        tp: template.reward.tp,
        badges: [...(template.reward.badges ?? [])],
      }),
      expiresAt: new Date(Date.now() + expiryHours * 3_600_000).toISOString(),
      category: questType,
      tags: [questType, "auto-generated"],
    });
  }
}

function fillQuestTemplate(
  template: string,
  variables: Record<string, number>,
): string {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) =>
    String(variables[key] ?? 0),
  );
}

export type QuestEngineOptions = {
  storageDir?: string;
  brotherhood?: BrotherhoodSystem;
  skillTracker?: SkillTracker;
  skillTree?: SkillTreeSystem;
  now?: () => Date;
};

export class QuestEngine {
  static readonly QUEST_LOG_FILE = "quest_log.jsonl";

  static readonly QUEST_STATE_FILE = "quest_state.json";

  readonly activeQuests = new Map<string, Quest>();

  readonly completedQuests = new Map<string, Quest>();

  readonly questChains = new Map<string, QuestChain>();

  readonly questHistory: Array<Record<string, unknown>> = [];

  readonly metrics: Record<string, number> = {
    interactions: 0,
    questions_asked: 0,
    facts_learned: 0,
    memory_recalls: 0,
    topics_discussed: 0,
    emotions_experienced: 0,
    current_streak: 0,
    professors_consulted: 0,
    weekly_interactions: 0,
    ltm_additions: 0,
    skills_unlocked: 0,
    badges_earned: 0,
    domains_explored: 0,
    total_interactions: 0,
    trust_score: 0,
    total_memories: 0,
    total_xp: 0,
    rank_index: 0,
  };

  private readonly uniqueSets: Record<string, Set<string>> = {
    topics_discussed: new Set<string>(),
    emotions_experienced: new Set<string>(),
    professors_consulted: new Set<string>(),
    domains_explored: new Set<string>(),
  };

  private readonly storageDir: string;

  private readonly brotherhood?: BrotherhoodSystem;

  private readonly skillTracker?: SkillTracker;

  private readonly skillTree?: SkillTreeSystem;

  private readonly now: () => Date;

  constructor(options: QuestEngineOptions = {}) {
    this.storageDir =
      options.storageDir ?? join(process.cwd(), ".nexus_cache", "quests");
    this.brotherhood = options.brotherhood;
    this.skillTracker = options.skillTracker;
    this.skillTree = options.skillTree;
    this.now = options.now ?? (() => new Date());
    mkdirSync(this.storageDir, { recursive: true });
    this.loadState();
  }

  generateDailyQuests(userLevel = 1): Quest[] {
    const now = this.now().getTime();
    for (const [questId, quest] of this.activeQuests.entries()) {
      if (
        quest.questType === QuestType.DAILY &&
        quest.expiresAt &&
        Date.parse(quest.expiresAt) <= now
      ) {
        quest.status = QuestStatus.EXPIRED;
        this.activeQuests.delete(questId);
        this.completedQuests.set(questId, quest);
      }
    }
    const currentDailies = Array.from(this.activeQuests.values()).filter(
      (quest) => quest.questType === QuestType.DAILY,
    );
    if (currentDailies.length >= 3) {
      return currentDailies.map((quest) => Quest.fromDict(quest.toDict())!);
    }
    const generated = QuestTemplate.generateDailyQuests(3 - currentDailies.length, userLevel);
    for (const quest of generated) {
      this.activeQuests.set(quest.id, quest);
    }
    this.saveState();
    return [...currentDailies, ...generated].map(
      (quest) => Quest.fromDict(quest.toDict())!,
    );
  }

  generateWeeklyQuests(userLevel = 1): Quest[] {
    const now = this.now().getTime();
    for (const [questId, quest] of this.activeQuests.entries()) {
      if (
        quest.questType === QuestType.WEEKLY &&
        quest.expiresAt &&
        Date.parse(quest.expiresAt) <= now
      ) {
        quest.status = QuestStatus.EXPIRED;
        this.activeQuests.delete(questId);
        this.completedQuests.set(questId, quest);
      }
    }
    const currentWeeklies = Array.from(this.activeQuests.values()).filter(
      (quest) => quest.questType === QuestType.WEEKLY,
    );
    if (currentWeeklies.length >= 2) {
      return currentWeeklies.map((quest) => Quest.fromDict(quest.toDict())!);
    }
    const generated = QuestTemplate.generateWeeklyQuests(
      2 - currentWeeklies.length,
      userLevel,
    );
    for (const quest of generated) {
      this.activeQuests.set(quest.id, quest);
    }
    this.saveState();
    return [...currentWeeklies, ...generated].map(
      (quest) => Quest.fromDict(quest.toDict())!,
    );
  }

  acceptQuest(questId: string): { accepted: boolean; reason: string } {
    const quest = this.activeQuests.get(questId);
    if (!quest) {
      return { accepted: false, reason: "Quest not found" };
    }
    const userXp = this.brotherhood?.totalXp ?? 0;
    const userLevel = this.brotherhood?.streakDays ?? 0;
    const completedQuestIds = [...this.completedQuests.keys()];
    const userBadges: string[] = [];
    const userSkills = this.getUserSkillIds();
    const decision = quest.canAccept({
      userXp,
      userLevel,
      completedQuests: completedQuestIds,
      userBadges,
      userSkills,
    });
    if (!decision.allowed) {
      return { accepted: false, reason: decision.reason };
    }
    quest.status = QuestStatus.ACTIVE;
    quest.acceptedAt = this.now().toISOString();
    this.logQuestEvent("accepted", quest);
    this.saveState();
    return { accepted: true, reason: `Quest '${quest.name}' accepted` };
  }

  updateProgress(
    metric: string,
    value = 1,
    uniqueValue?: string,
  ): Quest[] {
    if (this.metrics[metric] === undefined) {
      this.metrics[metric] = 0;
    }
    this.metrics[metric] += value;
    if (uniqueValue && this.uniqueSets[metric]) {
      this.uniqueSets[metric].add(uniqueValue);
      this.metrics[metric] = this.uniqueSets[metric].size;
    }
    const completed: Quest[] = [];
    for (const quest of this.activeQuests.values()) {
      if (quest.status !== QuestStatus.ACTIVE) {
        continue;
      }
      for (const objective of quest.objectives) {
        if (objective.targetMetric !== metric) {
          continue;
        }
        if (objective.objectiveType === "count") {
          objective.increment(value);
        } else if (objective.objectiveType === "unique") {
          objective.currentValue = this.uniqueSets[metric]?.size ?? 0;
        } else if (objective.objectiveType === "threshold") {
          objective.currentValue = this.metrics[metric] ?? 0;
        }
      }
      if (quest.isComplete) {
        quest.status = QuestStatus.COMPLETED;
        quest.completedAt = this.now().toISOString();
        completed.push(Quest.fromDict(quest.toDict())!);
        this.logQuestEvent("completed", quest);
      }
    }
    this.saveState();
    return completed;
  }

  claimReward(
    questId: string,
  ): {
    claimed: boolean;
    reward?: QuestReward;
    reason: string;
  } {
    const quest = this.activeQuests.get(questId);
    if (!quest) {
      return { claimed: false, reason: "Quest not found" };
    }
    if (quest.status !== QuestStatus.COMPLETED) {
      return {
        claimed: false,
        reason: `Quest status is ${quest.status}`,
      };
    }
    quest.reward.bonusMultiplier = QUEST_DIFFICULTY_MULTIPLIER[quest.difficulty];
    if (this.brotherhood) {
      this.brotherhood.awardXp("interaction", {
        baseAmount: quest.reward.totalXp,
        reason: `Quest: ${quest.name}`,
      });
      this.brotherhood.totalTp += quest.reward.totalTp;
    }
    quest.status = QuestStatus.CLAIMED;
    this.activeQuests.delete(questId);
    this.completedQuests.set(questId, quest);
    this.logQuestEvent("claimed", quest);
    this.saveState();
    return {
      claimed: true,
      reward: QuestReward.fromDict(quest.reward.toDict()),
      reason: `Claimed ${quest.reward.totalXp} XP and ${quest.reward.totalTp} TP`,
    };
  }

  getActiveQuests(questType?: QuestType): Quest[] {
    const quests = Array.from(this.activeQuests.values()).filter((quest) =>
      questType ? quest.questType === questType : true,
    );
    return quests.map((quest) => Quest.fromDict(quest.toDict())!);
  }

  getQuestSummary(): Record<string, unknown> {
    const active = Array.from(this.activeQuests.values());
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const questType of Object.values(QuestType)) {
      byType[questType] = active.filter((quest) => quest.questType === questType).length;
    }
    for (const status of Object.values(QuestStatus)) {
      byStatus[status] = active.filter((quest) => quest.status === status).length;
    }
    return {
      totalActive: active.length,
      byType,
      byStatus,
      completable: active.filter((quest) => quest.isComplete).length,
      expired: active.filter((quest) => quest.isExpired).length,
      totalCompleted: this.completedQuests.size,
      metrics: { ...this.metrics },
    };
  }

  private getUserSkillIds(): string[] {
    if (this.skillTracker) {
      return this.skillTracker.getTrackedSkills().map((skill) => skill.skillId);
    }
    if (this.skillTree) {
      return [...this.skillTree.unlockedSkills.keys()];
    }
    return [];
  }

  private loadState(): void {
    const statePath = join(this.storageDir, QuestEngine.QUEST_STATE_FILE);
    if (!existsSync(statePath)) {
      return;
    }
    try {
      const parsed = JSON.parse(readFileSync(statePath, "utf8")) as Record<
        string,
        unknown
      >;
      if (typeof parsed.metrics === "object" && parsed.metrics) {
        for (const [key, value] of Object.entries(parsed.metrics)) {
          if (typeof value === "number" && Number.isFinite(value)) {
            this.metrics[key] = value;
          }
        }
      }
      if (typeof parsed.uniqueSets === "object" && parsed.uniqueSets) {
        for (const [key, values] of Object.entries(parsed.uniqueSets)) {
          if (!Array.isArray(values)) {
            continue;
          }
          this.uniqueSets[key] = new Set(
            values.filter((item): item is string => typeof item === "string"),
          );
        }
      }
      if (Array.isArray(parsed.activeQuests)) {
        for (const questValue of parsed.activeQuests) {
          const quest = Quest.fromDict(questValue);
          if (quest) {
            this.activeQuests.set(quest.id, quest);
          }
        }
      }
      if (Array.isArray(parsed.completedQuests)) {
        for (const questValue of parsed.completedQuests) {
          const quest = Quest.fromDict(questValue);
          if (quest) {
            this.completedQuests.set(quest.id, quest);
          }
        }
      }
    } catch {
      return;
    }
  }

  private saveState(): void {
    const statePath = join(this.storageDir, QuestEngine.QUEST_STATE_FILE);
    const payload = {
      metrics: { ...this.metrics },
      uniqueSets: Object.fromEntries(
        Object.entries(this.uniqueSets).map(([key, values]) => [key, [...values]]),
      ),
      activeQuests: [...this.activeQuests.values()].map((quest) => quest.toDict()),
      completedQuests: [...this.completedQuests.values()]
        .slice(-100)
        .map((quest) => quest.toDict()),
    };
    writeFileSync(statePath, JSON.stringify(payload, null, 2), "utf8");
  }

  private logQuestEvent(event: string, quest: Quest): void {
    const logPath = join(this.storageDir, QuestEngine.QUEST_LOG_FILE);
    const entry = {
      timestamp: this.now().toISOString(),
      event,
      questId: quest.id,
      questName: quest.name,
      questType: quest.questType,
      difficulty: quest.difficulty,
    };
    appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf8");
  }
}

export type MissionContext = {
  userInput: string;
  agentResponse: string;
  topics: string[];
  entities: string[];
  sentiment: string;
  intent: string;
  domain: string;
  complexity: number;
  keywords: string[];
};

export class MissionGenerator {
  static readonly MISSION_PATTERNS: Record<
    string,
    Array<{ name: string; description: string; category: string }>
  > = {
    learning: [
      {
        name: "Learn about {topic}",
        description: "Explore and understand {topic} through dialogue",
        category: "knowledge",
      },
      {
        name: "Master {topic}",
        description: "Demonstrate practical understanding of {topic}",
        category: "skill",
      },
    ],
    creative: [
      {
        name: "Create {topic}",
        description: "Produce a new artifact centered on {topic}",
        category: "creative",
      },
    ],
    problem_solving: [
      {
        name: "Solve {topic}",
        description: "Investigate and resolve {topic}",
        category: "problem",
      },
    ],
    exploration: [
      {
        name: "Discover {topic}",
        description: "Map and explain the key ideas of {topic}",
        category: "exploration",
      },
    ],
  };

  readonly generatedMissions: string[] = [];

  constructor(private readonly questEngine: QuestEngine) {}

  extractContext(userInput: string, agentResponse: string): MissionContext {
    const keywords = Array.from(
      new Set((userInput.toLowerCase().match(/\b\w{4,}\b/g) ?? []).slice(0, 10)),
    );
    const topics = keywords.filter((keyword) => keyword.length > 5).slice(0, 3);
    let intent = "general";
    const normalized = userInput.toLowerCase();
    if (["how", "what", "why", "explain"].some((token) => normalized.includes(token))) {
      intent = "learning";
    } else if (
      ["create", "make", "build", "design"].some((token) =>
        normalized.includes(token),
      )
    ) {
      intent = "creative";
    } else if (
      ["fix", "solve", "debug", "help"].some((token) => normalized.includes(token))
    ) {
      intent = "problem_solving";
    } else if (
      ["explore", "discover", "find"].some((token) => normalized.includes(token))
    ) {
      intent = "exploration";
    }
    const complexity = Math.min(1, userInput.length / 200);
    return {
      userInput,
      agentResponse,
      topics,
      entities: [],
      sentiment: "neutral",
      intent,
      domain: "general",
      complexity,
      keywords,
    };
  }

  maybeGenerateMission(context: MissionContext): Quest | undefined {
    if (Math.random() > 0.2 || context.topics.length === 0) {
      return undefined;
    }
    const templates =
      MissionGenerator.MISSION_PATTERNS[context.intent] ??
      MissionGenerator.MISSION_PATTERNS.learning;
    const template = randomPick(templates);
    if (!template) {
      return undefined;
    }
    const topic = context.topics[0];
    const difficulty =
      context.complexity < 0.3
        ? QuestDifficulty.EASY
        : context.complexity < 0.6
          ? QuestDifficulty.NORMAL
          : context.complexity < 0.8
            ? QuestDifficulty.HARD
            : QuestDifficulty.HEROIC;
    const mission = new Quest({
      name: template.name.replace("{topic}", topic),
      description: template.description.replace("{topic}", topic),
      questType: QuestType.SIDE,
      difficulty,
      status: QuestStatus.ACTIVE,
      objectives: [
        new QuestObjective({
          description: `Continue exploring ${topic}`,
          objectiveType: "count",
          targetValue: 3,
          targetMetric: "interactions",
        }),
      ],
      reward: new QuestReward({
        xp: Math.floor(50 * QUEST_DIFFICULTY_MULTIPLIER[difficulty]),
        tp: Math.floor(10 * QUEST_DIFFICULTY_MULTIPLIER[difficulty]),
      }),
      category: template.category,
      tags: [context.intent, topic, "auto-generated"],
      icon: "🎯",
      metadata: { generatedFrom: [...context.keywords] },
    });
    this.questEngine.activeQuests.set(mission.id, mission);
    this.generatedMissions.push(mission.id);
    return Quest.fromDict(mission.toDict())!;
  }
}
