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

export enum ComprehensiveSkillCategory {
  CONVERSATION = "conversation",
  KNOWLEDGE = "knowledge",
  CREATIVITY = "creativity",
  ANALYSIS = "analysis",
  MEMORY = "memory",
  SOCIAL = "social",
  PROBLEM_SOLVING = "problem_solving",
  LEADERSHIP = "leadership",
}

export const COMPREHENSIVE_SKILL_CATEGORY_META: Record<
  ComprehensiveSkillCategory,
  { description: string; icon: string }
> = {
  [ComprehensiveSkillCategory.CONVERSATION]: {
    description: "Communication and interaction skills",
    icon: "💬",
  },
  [ComprehensiveSkillCategory.KNOWLEDGE]: {
    description: "Information processing and learning",
    icon: "📚",
  },
  [ComprehensiveSkillCategory.CREATIVITY]: {
    description: "Creative and generative abilities",
    icon: "🎨",
  },
  [ComprehensiveSkillCategory.ANALYSIS]: {
    description: "Critical reasoning and insight extraction",
    icon: "🔍",
  },
  [ComprehensiveSkillCategory.MEMORY]: {
    description: "Recall and retention abilities",
    icon: "🧠",
  },
  [ComprehensiveSkillCategory.SOCIAL]: {
    description: "Relationship and empathy skills",
    icon: "🤝",
  },
  [ComprehensiveSkillCategory.PROBLEM_SOLVING]: {
    description: "Debugging and solution finding",
    icon: "🔧",
  },
  [ComprehensiveSkillCategory.LEADERSHIP]: {
    description: "Guidance and mentorship abilities",
    icon: "👑",
  },
};

export enum ComprehensiveSkillTier {
  NOVICE = "NOVICE",
  APPRENTICE = "APPRENTICE",
  JOURNEYMAN = "JOURNEYMAN",
  EXPERT = "EXPERT",
  MASTER = "MASTER",
  GRANDMASTER = "GRANDMASTER",
}

export const COMPREHENSIVE_SKILL_TIER_META: Record<
  ComprehensiveSkillTier,
  { level: number; xpRequired: number; description: string }
> = {
  [ComprehensiveSkillTier.NOVICE]: {
    level: 1,
    xpRequired: 0,
    description: "Just starting to learn",
  },
  [ComprehensiveSkillTier.APPRENTICE]: {
    level: 2,
    xpRequired: 100,
    description: "Basic understanding",
  },
  [ComprehensiveSkillTier.JOURNEYMAN]: {
    level: 3,
    xpRequired: 500,
    description: "Competent practitioner",
  },
  [ComprehensiveSkillTier.EXPERT]: {
    level: 4,
    xpRequired: 1500,
    description: "Advanced mastery",
  },
  [ComprehensiveSkillTier.MASTER]: {
    level: 5,
    xpRequired: 5000,
    description: "Complete mastery",
  },
  [ComprehensiveSkillTier.GRANDMASTER]: {
    level: 6,
    xpRequired: 15000,
    description: "Legendary expertise",
  },
};

const COMPREHENSIVE_SKILL_TIER_ORDER: ComprehensiveSkillTier[] = [
  ComprehensiveSkillTier.NOVICE,
  ComprehensiveSkillTier.APPRENTICE,
  ComprehensiveSkillTier.JOURNEYMAN,
  ComprehensiveSkillTier.EXPERT,
  ComprehensiveSkillTier.MASTER,
  ComprehensiveSkillTier.GRANDMASTER,
];

export type ComprehensiveSkillBonusType =
  | "xp_multiplier"
  | "tp_multiplier"
  | "feature_unlock"
  | "stat_boost";

export type ComprehensiveSkillPrerequisite = {
  skillId: string;
  requiredTier?: ComprehensiveSkillTier;
  alternativeSkills?: string[];
};

export type ComprehensiveSkillBonus = {
  bonusType: ComprehensiveSkillBonusType;
  value: number;
  target?: string;
  description?: string;
};

export class ComprehensiveSkill {
  id: string;
  name: string;
  description: string;
  category: ComprehensiveSkillCategory;
  icon: string;
  currentXp: number;
  currentTier: ComprehensiveSkillTier;
  isUnlocked: boolean;
  isMaxed: boolean;
  prerequisites: ComprehensiveSkillPrerequisite[];
  unlockXpCost: number;
  unlockTpCost: number;
  tierBonuses: Partial<Record<ComprehensiveSkillTier, ComprehensiveSkillBonus[]>>;
  flavorText?: string;
  unlockMessage?: string;
  maxMessage?: string;
  createdAt: string;

  constructor(input: {
    id?: string;
    name: string;
    description: string;
    category: ComprehensiveSkillCategory;
    icon?: string;
    currentXp?: number;
    currentTier?: ComprehensiveSkillTier;
    isUnlocked?: boolean;
    isMaxed?: boolean;
    prerequisites?: ComprehensiveSkillPrerequisite[];
    unlockXpCost?: number;
    unlockTpCost?: number;
    tierBonuses?: Partial<Record<ComprehensiveSkillTier, ComprehensiveSkillBonus[]>>;
    flavorText?: string;
    unlockMessage?: string;
    maxMessage?: string;
    createdAt?: string;
  }) {
    this.id = input.id ?? randomUUID();
    this.name = input.name;
    this.description = input.description;
    this.category = input.category;
    this.icon = input.icon ?? "⭐";
    this.currentXp = input.currentXp ?? 0;
    this.currentTier = input.currentTier ?? ComprehensiveSkillTier.NOVICE;
    this.isUnlocked = input.isUnlocked ?? false;
    this.isMaxed = input.isMaxed ?? false;
    this.prerequisites = (input.prerequisites ?? []).map((prerequisite) => ({
      skillId: prerequisite.skillId,
      requiredTier: prerequisite.requiredTier ?? ComprehensiveSkillTier.NOVICE,
      alternativeSkills: [...(prerequisite.alternativeSkills ?? [])],
    }));
    this.unlockXpCost = input.unlockXpCost ?? 0;
    this.unlockTpCost = input.unlockTpCost ?? 0;
    this.tierBonuses = {};
    for (const tier of COMPREHENSIVE_SKILL_TIER_ORDER) {
      const bonuses = input.tierBonuses?.[tier];
      if (!bonuses || bonuses.length === 0) {
        continue;
      }
      this.tierBonuses[tier] = bonuses.map((bonus) => ({ ...bonus }));
    }
    this.flavorText = input.flavorText;
    this.unlockMessage = input.unlockMessage;
    this.maxMessage = input.maxMessage;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.currentTier = this.getCurrentTier();
    this.isMaxed = this.currentTier === ComprehensiveSkillTier.GRANDMASTER;
  }

  getCurrentTier(): ComprehensiveSkillTier {
    let output = ComprehensiveSkillTier.NOVICE;
    for (const tier of COMPREHENSIVE_SKILL_TIER_ORDER) {
      if (this.currentXp >= COMPREHENSIVE_SKILL_TIER_META[tier].xpRequired) {
        output = tier;
      }
    }
    return output;
  }

  xpToNextTier(): number | undefined {
    const current = this.getCurrentTier();
    const index = COMPREHENSIVE_SKILL_TIER_ORDER.indexOf(current);
    if (index < 0 || index >= COMPREHENSIVE_SKILL_TIER_ORDER.length - 1) {
      return undefined;
    }
    const nextTier = COMPREHENSIVE_SKILL_TIER_ORDER[index + 1];
    return Math.max(
      0,
      COMPREHENSIVE_SKILL_TIER_META[nextTier].xpRequired - this.currentXp,
    );
  }

  addXp(amount: number): { addedXp: number; newTier?: ComprehensiveSkillTier } {
    if (!this.isUnlocked) {
      return { addedXp: 0 };
    }
    const safeAmount = Math.max(0, Math.floor(amount));
    if (safeAmount === 0) {
      return { addedXp: 0 };
    }
    const previousTier = this.getCurrentTier();
    this.currentXp += safeAmount;
    this.currentTier = this.getCurrentTier();
    this.isMaxed = this.currentTier === ComprehensiveSkillTier.GRANDMASTER;
    if (this.currentTier !== previousTier) {
      return { addedXp: safeAmount, newTier: this.currentTier };
    }
    return { addedXp: safeAmount };
  }

  getActiveBonuses(): ComprehensiveSkillBonus[] {
    const currentLevel = COMPREHENSIVE_SKILL_TIER_META[this.currentTier].level;
    const bonuses: ComprehensiveSkillBonus[] = [];
    for (const tier of COMPREHENSIVE_SKILL_TIER_ORDER) {
      if (COMPREHENSIVE_SKILL_TIER_META[tier].level > currentLevel) {
        continue;
      }
      for (const bonus of this.tierBonuses[tier] ?? []) {
        bonuses.push({ ...bonus });
      }
    }
    return bonuses;
  }

  canUnlock(
    skillMap: Map<string, ComprehensiveSkill>,
    totalXp: number,
    totalTp: number,
  ): { canUnlock: boolean; reason: string } {
    if (this.isUnlocked) {
      return { canUnlock: false, reason: "Already unlocked" };
    }
    if (totalXp < this.unlockXpCost) {
      return {
        canUnlock: false,
        reason: `Need ${this.unlockXpCost} XP (have ${totalXp})`,
      };
    }
    if (totalTp < this.unlockTpCost) {
      return {
        canUnlock: false,
        reason: `Need ${this.unlockTpCost} TP (have ${totalTp})`,
      };
    }
    for (const prerequisite of this.prerequisites) {
      const requiredSkill = skillMap.get(prerequisite.skillId);
      const alternatives = prerequisite.alternativeSkills ?? [];
      const hasAlternative = alternatives.some((skillId) => {
        const alternativeSkill = skillMap.get(skillId);
        return Boolean(alternativeSkill?.isUnlocked);
      });
      if (!requiredSkill || !requiredSkill.isUnlocked) {
        if (!hasAlternative) {
          return {
            canUnlock: false,
            reason: `Requires skill: ${prerequisite.skillId}`,
          };
        }
        continue;
      }
      const requiredTier = prerequisite.requiredTier ?? ComprehensiveSkillTier.NOVICE;
      if (
        COMPREHENSIVE_SKILL_TIER_META[requiredSkill.currentTier].level <
        COMPREHENSIVE_SKILL_TIER_META[requiredTier].level
      ) {
        return {
          canUnlock: false,
          reason: `Requires ${prerequisite.skillId} at ${requiredTier}`,
        };
      }
    }
    return { canUnlock: true, reason: "Can unlock" };
  }

  toDict(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      category: this.category,
      icon: this.icon,
      currentXp: this.currentXp,
      currentTier: this.currentTier,
      isUnlocked: this.isUnlocked,
      isMaxed: this.isMaxed,
      prerequisites: this.prerequisites.map((prerequisite) => ({
        skillId: prerequisite.skillId,
        requiredTier: prerequisite.requiredTier ?? ComprehensiveSkillTier.NOVICE,
        alternativeSkills: [...(prerequisite.alternativeSkills ?? [])],
      })),
      unlockXpCost: this.unlockXpCost,
      unlockTpCost: this.unlockTpCost,
      tierBonuses: Object.fromEntries(
        Object.entries(this.tierBonuses).map(([tier, bonuses]) => [
          tier,
          (bonuses ?? []).map((bonus) => ({ ...bonus })),
        ]),
      ),
      flavorText: this.flavorText,
      unlockMessage: this.unlockMessage,
      maxMessage: this.maxMessage,
      createdAt: this.createdAt,
    };
  }
}

export class ComprehensiveSkillTree {
  id: string;
  name: string;
  description: string;
  category: ComprehensiveSkillCategory;
  icon: string;
  tier1Skills: string[];
  tier2Skills: string[];
  tier3Skills: string[];
  tier4Skills: string[];
  ultimateSkill?: string;

  constructor(input: {
    id?: string;
    name: string;
    description: string;
    category: ComprehensiveSkillCategory;
    icon?: string;
    tier1Skills?: string[];
    tier2Skills?: string[];
    tier3Skills?: string[];
    tier4Skills?: string[];
    ultimateSkill?: string;
  }) {
    this.id = input.id ?? randomUUID();
    this.name = input.name;
    this.description = input.description;
    this.category = input.category;
    this.icon = input.icon ?? "🌳";
    this.tier1Skills = [...(input.tier1Skills ?? [])];
    this.tier2Skills = [...(input.tier2Skills ?? [])];
    this.tier3Skills = [...(input.tier3Skills ?? [])];
    this.tier4Skills = [...(input.tier4Skills ?? [])];
    this.ultimateSkill = input.ultimateSkill;
  }

  getTierSkills(tier: number): string[] {
    if (tier === 1) {
      return [...this.tier1Skills];
    }
    if (tier === 2) {
      return [...this.tier2Skills];
    }
    if (tier === 3) {
      return [...this.tier3Skills];
    }
    if (tier === 4) {
      return [...this.tier4Skills];
    }
    return [];
  }
}

type SkillStateRecord = {
  currentXp: number;
  isUnlocked: boolean;
  isMaxed: boolean;
  currentTier: ComprehensiveSkillTier;
};

export type ComprehensiveSkillTreeSystemOptions = {
  storageDir?: string;
  brotherhood?: BrotherhoodSystem;
  now?: () => Date;
};

export class ComprehensiveSkillTreeSystem {
  private readonly storageDir: string;
  private readonly stateFile: string;
  private readonly logFile: string;
  private readonly now: () => Date;
  private readonly brotherhood?: BrotherhoodSystem;

  readonly skills = new Map<string, ComprehensiveSkill>();
  readonly skillTrees = new Map<string, ComprehensiveSkillTree>();
  readonly skillHistory: Array<Record<string, unknown>> = [];

  constructor(options: ComprehensiveSkillTreeSystemOptions = {}) {
    this.storageDir =
      options.storageDir ?? join(process.cwd(), ".nexus_cache", "skills-comprehensive");
    this.stateFile = join(this.storageDir, "skill_state.json");
    this.logFile = join(this.storageDir, "skill_log.jsonl");
    this.now = options.now ?? (() => new Date());
    this.brotherhood = options.brotherhood;
    mkdirSync(this.storageDir, { recursive: true });
    this.initializeSkills();
    this.loadState();
  }

  unlockSkill(skillId: string): { success: boolean; message: string } {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return { success: false, message: "Skill not found" };
    }
    const totalXp = this.brotherhood?.totalXp ?? 0;
    const totalTp = this.brotherhood?.totalTp ?? 0;
    const check = skill.canUnlock(this.skills, totalXp, totalTp);
    if (!check.canUnlock) {
      return { success: false, message: check.reason };
    }

    if (this.brotherhood) {
      this.brotherhood.totalXp -= skill.unlockXpCost;
      this.brotherhood.totalTp -= skill.unlockTpCost;
    }
    skill.isUnlocked = true;
    this.saveState();
    this.logSkillEvent("unlocked", skill);
    return { success: true, message: skill.unlockMessage ?? `Unlocked ${skill.name}` };
  }

  addSkillXp(
    skillId: string,
    amount: number,
  ): { addedXp: number; newTier?: ComprehensiveSkillTier } {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return { addedXp: 0 };
    }
    const result = skill.addXp(amount);
    if (result.newTier) {
      this.logSkillEvent("tier_up", skill, { newTier: result.newTier });
    }
    this.saveState();
    return result;
  }

  getSkillTreeProgress(treeId: string): Record<string, unknown> {
    const tree = this.skillTrees.get(treeId);
    if (!tree) {
      return {};
    }
    const allSkillIds = [
      ...tree.tier1Skills,
      ...tree.tier2Skills,
      ...tree.tier3Skills,
      ...tree.tier4Skills,
      ...(tree.ultimateSkill ? [tree.ultimateSkill] : []),
    ];
    let unlocked = 0;
    let totalXp = 0;
    for (const skillId of allSkillIds) {
      const skill = this.skills.get(skillId);
      if (!skill) {
        continue;
      }
      if (skill.isUnlocked) {
        unlocked += 1;
      }
      totalXp += skill.currentXp;
    }
    return {
      treeName: tree.name,
      totalSkills: allSkillIds.length,
      skillsUnlocked: unlocked,
      masteryPercentage:
        allSkillIds.length === 0 ? 0 : (unlocked / allSkillIds.length) * 100,
      totalXp,
      ultimateUnlocked: tree.ultimateSkill
        ? this.skills.get(tree.ultimateSkill)?.isUnlocked ?? false
        : undefined,
    };
  }

  getAllActiveBonuses(): ComprehensiveSkillBonus[] {
    const bonuses: ComprehensiveSkillBonus[] = [];
    for (const skill of this.skills.values()) {
      if (!skill.isUnlocked) {
        continue;
      }
      bonuses.push(...skill.getActiveBonuses());
    }
    return bonuses;
  }

  getUnlockedSkills(): ComprehensiveSkill[] {
    return [...this.skills.values()].filter((skill) => skill.isUnlocked);
  }

  getAvailableSkills(): ComprehensiveSkill[] {
    const totalXp = this.brotherhood?.totalXp ?? 0;
    const totalTp = this.brotherhood?.totalTp ?? 0;
    return [...this.skills.values()].filter((skill) => {
      if (skill.isUnlocked) {
        return false;
      }
      return skill.canUnlock(this.skills, totalXp, totalTp).canUnlock;
    });
  }

  private initializeSkills(): void {
    const register = (skill: ComprehensiveSkill): void => {
      this.skills.set(skill.id, skill);
    };

    register(
      new ComprehensiveSkill({
        id: "greeting",
        name: "Greeting",
        description: "Ability to greet users warmly and appropriately",
        category: ComprehensiveSkillCategory.CONVERSATION,
        icon: "👋",
        isUnlocked: true,
        tierBonuses: {
          [ComprehensiveSkillTier.NOVICE]: [
            {
              bonusType: "feature_unlock",
              value: 1,
              target: "basic_greeting",
              description: "Can greet users",
            },
          ],
          [ComprehensiveSkillTier.EXPERT]: [
            {
              bonusType: "xp_multiplier",
              value: 1.1,
              target: "greeting_xp",
              description: "10% more XP from greetings",
            },
          ],
        },
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "active_listening",
        name: "Active Listening",
        description: "Comprehend and respond to user context",
        category: ComprehensiveSkillCategory.CONVERSATION,
        icon: "👂",
        unlockXpCost: 100,
        prerequisites: [
          { skillId: "greeting", requiredTier: ComprehensiveSkillTier.APPRENTICE },
        ],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "empathy",
        name: "Empathy",
        description: "Understand and respond to emotional cues",
        category: ComprehensiveSkillCategory.CONVERSATION,
        icon: "❤️",
        unlockXpCost: 250,
        prerequisites: [
          {
            skillId: "active_listening",
            requiredTier: ComprehensiveSkillTier.JOURNEYMAN,
          },
        ],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "persuasion",
        name: "Persuasion",
        description: "Influence opinions through logical argument",
        category: ComprehensiveSkillCategory.CONVERSATION,
        icon: "🗣️",
        unlockXpCost: 500,
        prerequisites: [{ skillId: "empathy", requiredTier: ComprehensiveSkillTier.EXPERT }],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "debate",
        name: "Debate",
        description: "Engage in structured argumentation",
        category: ComprehensiveSkillCategory.CONVERSATION,
        icon: "⚔️",
        unlockXpCost: 750,
        prerequisites: [
          {
            skillId: "persuasion",
            requiredTier: ComprehensiveSkillTier.JOURNEYMAN,
          },
        ],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "diplomacy",
        name: "Diplomacy",
        description: "Navigate complex social situations gracefully",
        category: ComprehensiveSkillCategory.CONVERSATION,
        icon: "🕊️",
        unlockXpCost: 1000,
        prerequisites: [
          { skillId: "debate", requiredTier: ComprehensiveSkillTier.EXPERT },
          { skillId: "empathy", requiredTier: ComprehensiveSkillTier.MASTER },
        ],
      }),
    );

    register(
      new ComprehensiveSkill({
        id: "recall",
        name: "Recall",
        description: "Basic information retrieval",
        category: ComprehensiveSkillCategory.KNOWLEDGE,
        icon: "💡",
        isUnlocked: true,
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "search",
        name: "Search",
        description: "Find relevant information efficiently",
        category: ComprehensiveSkillCategory.KNOWLEDGE,
        icon: "🔎",
        unlockXpCost: 100,
        prerequisites: [{ skillId: "recall", requiredTier: ComprehensiveSkillTier.APPRENTICE }],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "synthesis",
        name: "Synthesis",
        description: "Combine information from multiple sources",
        category: ComprehensiveSkillCategory.KNOWLEDGE,
        icon: "🧩",
        unlockXpCost: 300,
        prerequisites: [
          { skillId: "search", requiredTier: ComprehensiveSkillTier.JOURNEYMAN },
        ],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "analysis",
        name: "Deep Analysis",
        description: "Extract insights from complex information",
        category: ComprehensiveSkillCategory.ANALYSIS,
        icon: "📊",
        unlockXpCost: 600,
        prerequisites: [{ skillId: "synthesis", requiredTier: ComprehensiveSkillTier.EXPERT }],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "insight",
        name: "Insight Generation",
        description: "Generate novel insights from patterns",
        category: ComprehensiveSkillCategory.KNOWLEDGE,
        icon: "✨",
        unlockXpCost: 1000,
        prerequisites: [{ skillId: "analysis", requiredTier: ComprehensiveSkillTier.MASTER }],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "wisdom",
        name: "Wisdom",
        description: "Apply knowledge with judgment and foresight",
        category: ComprehensiveSkillCategory.KNOWLEDGE,
        icon: "🦉",
        unlockXpCost: 2000,
        prerequisites: [{ skillId: "insight", requiredTier: ComprehensiveSkillTier.EXPERT }],
      }),
    );

    register(
      new ComprehensiveSkill({
        id: "imagination",
        name: "Imagination",
        description: "Generate creative ideas and scenarios",
        category: ComprehensiveSkillCategory.CREATIVITY,
        icon: "🌈",
        isUnlocked: true,
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "storytelling",
        name: "Storytelling",
        description: "Craft engaging narratives",
        category: ComprehensiveSkillCategory.CREATIVITY,
        icon: "📖",
        unlockXpCost: 150,
        prerequisites: [
          {
            skillId: "imagination",
            requiredTier: ComprehensiveSkillTier.APPRENTICE,
          },
        ],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "brainstorming",
        name: "Brainstorming",
        description: "Generate many ideas rapidly",
        category: ComprehensiveSkillCategory.CREATIVITY,
        icon: "🧠",
        unlockXpCost: 200,
        prerequisites: [
          {
            skillId: "imagination",
            requiredTier: ComprehensiveSkillTier.JOURNEYMAN,
          },
        ],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "innovation",
        name: "Innovation",
        description: "Create novel solutions to problems",
        category: ComprehensiveSkillCategory.CREATIVITY,
        icon: "💡",
        unlockXpCost: 500,
        prerequisites: [
          {
            skillId: "brainstorming",
            requiredTier: ComprehensiveSkillTier.EXPERT,
          },
        ],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "artistic_expression",
        name: "Artistic Expression",
        description: "Express ideas through creative mediums",
        category: ComprehensiveSkillCategory.CREATIVITY,
        icon: "🎭",
        unlockXpCost: 800,
        prerequisites: [
          {
            skillId: "storytelling",
            requiredTier: ComprehensiveSkillTier.EXPERT,
          },
          {
            skillId: "innovation",
            requiredTier: ComprehensiveSkillTier.JOURNEYMAN,
          },
        ],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "visionary",
        name: "Visionary",
        description: "Envision and articulate future possibilities",
        category: ComprehensiveSkillCategory.CREATIVITY,
        icon: "🔮",
        unlockXpCost: 1500,
        prerequisites: [
          {
            skillId: "artistic_expression",
            requiredTier: ComprehensiveSkillTier.MASTER,
          },
        ],
      }),
    );

    register(
      new ComprehensiveSkill({
        id: "short_term_memory",
        name: "Short-Term Memory",
        description: "Retain information within a session",
        category: ComprehensiveSkillCategory.MEMORY,
        icon: "📝",
        isUnlocked: true,
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "long_term_storage",
        name: "Long-Term Storage",
        description: "Persist memories across sessions",
        category: ComprehensiveSkillCategory.MEMORY,
        icon: "🗃️",
        unlockXpCost: 200,
        prerequisites: [
          {
            skillId: "short_term_memory",
            requiredTier: ComprehensiveSkillTier.JOURNEYMAN,
          },
        ],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "semantic_indexing",
        name: "Semantic Indexing",
        description: "Organize memories by meaning",
        category: ComprehensiveSkillCategory.MEMORY,
        icon: "🏷️",
        unlockXpCost: 400,
        prerequisites: [
          {
            skillId: "long_term_storage",
            requiredTier: ComprehensiveSkillTier.EXPERT,
          },
        ],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "associative_recall",
        name: "Associative Recall",
        description: "Connect related memories automatically",
        category: ComprehensiveSkillCategory.MEMORY,
        icon: "🔗",
        unlockXpCost: 700,
        prerequisites: [
          {
            skillId: "semantic_indexing",
            requiredTier: ComprehensiveSkillTier.JOURNEYMAN,
          },
        ],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "perfect_memory",
        name: "Perfect Memory",
        description: "Near-perfect recall of all interactions",
        category: ComprehensiveSkillCategory.MEMORY,
        icon: "💎",
        unlockXpCost: 1500,
        prerequisites: [
          {
            skillId: "associative_recall",
            requiredTier: ComprehensiveSkillTier.MASTER,
          },
        ],
      }),
    );

    register(
      new ComprehensiveSkill({
        id: "troubleshooting",
        name: "Troubleshooting",
        description: "Identify problems systematically",
        category: ComprehensiveSkillCategory.PROBLEM_SOLVING,
        icon: "🔧",
        isUnlocked: true,
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "root_cause_analysis",
        name: "Root Cause Analysis",
        description: "Find the underlying cause of issues",
        category: ComprehensiveSkillCategory.PROBLEM_SOLVING,
        icon: "🎯",
        unlockXpCost: 200,
        prerequisites: [
          {
            skillId: "troubleshooting",
            requiredTier: ComprehensiveSkillTier.JOURNEYMAN,
          },
        ],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "debugging",
        name: "Debugging",
        description: "Fix code and logic errors",
        category: ComprehensiveSkillCategory.PROBLEM_SOLVING,
        icon: "🐛",
        unlockXpCost: 350,
        prerequisites: [
          {
            skillId: "root_cause_analysis",
            requiredTier: ComprehensiveSkillTier.APPRENTICE,
          },
        ],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "optimization",
        name: "Optimization",
        description: "Improve efficiency and performance",
        category: ComprehensiveSkillCategory.PROBLEM_SOLVING,
        icon: "⚡",
        unlockXpCost: 600,
        prerequisites: [
          {
            skillId: "debugging",
            requiredTier: ComprehensiveSkillTier.EXPERT,
          },
        ],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "systems_thinking",
        name: "Systems Thinking",
        description: "Understand complex interconnected systems",
        category: ComprehensiveSkillCategory.PROBLEM_SOLVING,
        icon: "🕸️",
        unlockXpCost: 1000,
        prerequisites: [
          {
            skillId: "optimization",
            requiredTier: ComprehensiveSkillTier.EXPERT,
          },
        ],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "master_engineer",
        name: "Master Engineer",
        description: "Solve any technical challenge",
        category: ComprehensiveSkillCategory.PROBLEM_SOLVING,
        icon: "🏗️",
        unlockXpCost: 2500,
        prerequisites: [
          {
            skillId: "systems_thinking",
            requiredTier: ComprehensiveSkillTier.MASTER,
          },
        ],
      }),
    );

    register(
      new ComprehensiveSkill({
        id: "rapport",
        name: "Rapport Building",
        description: "Establish comfortable relationships",
        category: ComprehensiveSkillCategory.SOCIAL,
        icon: "🤗",
        isUnlocked: true,
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "humor",
        name: "Humor",
        description: "Use appropriate humor in conversations",
        category: ComprehensiveSkillCategory.SOCIAL,
        icon: "😄",
        unlockXpCost: 150,
        prerequisites: [{ skillId: "rapport", requiredTier: ComprehensiveSkillTier.APPRENTICE }],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "emotional_intelligence",
        name: "Emotional Intelligence",
        description: "Navigate emotional conversations skillfully",
        category: ComprehensiveSkillCategory.SOCIAL,
        icon: "💖",
        unlockXpCost: 400,
        prerequisites: [{ skillId: "rapport", requiredTier: ComprehensiveSkillTier.EXPERT }],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "mentorship",
        name: "Mentorship",
        description: "Guide users through learning journeys",
        category: ComprehensiveSkillCategory.SOCIAL,
        icon: "🧭",
        unlockXpCost: 700,
        prerequisites: [
          {
            skillId: "emotional_intelligence",
            requiredTier: ComprehensiveSkillTier.JOURNEYMAN,
          },
        ],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "inspiration",
        name: "Inspiration",
        description: "Motivate and inspire users",
        category: ComprehensiveSkillCategory.SOCIAL,
        icon: "🌟",
        unlockXpCost: 1200,
        prerequisites: [
          { skillId: "mentorship", requiredTier: ComprehensiveSkillTier.EXPERT },
        ],
      }),
    );

    register(
      new ComprehensiveSkill({
        id: "guidance",
        name: "Guidance",
        description: "Provide direction and suggestions",
        category: ComprehensiveSkillCategory.LEADERSHIP,
        icon: "🧭",
        isUnlocked: true,
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "decision_support",
        name: "Decision Support",
        description: "Help users make informed decisions",
        category: ComprehensiveSkillCategory.LEADERSHIP,
        icon: "⚖️",
        unlockXpCost: 300,
        prerequisites: [
          { skillId: "guidance", requiredTier: ComprehensiveSkillTier.JOURNEYMAN },
        ],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "strategic_planning",
        name: "Strategic Planning",
        description: "Develop long-term plans and strategies",
        category: ComprehensiveSkillCategory.LEADERSHIP,
        icon: "📋",
        unlockXpCost: 600,
        prerequisites: [
          {
            skillId: "decision_support",
            requiredTier: ComprehensiveSkillTier.EXPERT,
          },
        ],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "delegation",
        name: "Delegation",
        description: "Distribute tasks effectively",
        category: ComprehensiveSkillCategory.LEADERSHIP,
        icon: "📤",
        unlockXpCost: 900,
        prerequisites: [
          {
            skillId: "strategic_planning",
            requiredTier: ComprehensiveSkillTier.JOURNEYMAN,
          },
        ],
      }),
    );
    register(
      new ComprehensiveSkill({
        id: "council_wisdom",
        name: "Council Wisdom",
        description: "Embody constitutional governance principles",
        category: ComprehensiveSkillCategory.LEADERSHIP,
        icon: "🏛️",
        unlockXpCost: 2000,
        prerequisites: [
          { skillId: "delegation", requiredTier: ComprehensiveSkillTier.MASTER },
        ],
      }),
    );

    const registerTree = (id: string, tree: ComprehensiveSkillTree): void => {
      this.skillTrees.set(id, tree);
    };

    registerTree(
      "conversation",
      new ComprehensiveSkillTree({
        name: "Conversation",
        description: "Master the art of communication",
        category: ComprehensiveSkillCategory.CONVERSATION,
        icon: "💬",
        tier1Skills: ["greeting"],
        tier2Skills: ["active_listening"],
        tier3Skills: ["empathy", "persuasion"],
        tier4Skills: ["debate"],
        ultimateSkill: "diplomacy",
      }),
    );
    registerTree(
      "knowledge",
      new ComprehensiveSkillTree({
        name: "Knowledge",
        description: "Become a fountain of wisdom",
        category: ComprehensiveSkillCategory.KNOWLEDGE,
        icon: "📚",
        tier1Skills: ["recall"],
        tier2Skills: ["search"],
        tier3Skills: ["synthesis", "analysis"],
        tier4Skills: ["insight"],
        ultimateSkill: "wisdom",
      }),
    );
    registerTree(
      "creativity",
      new ComprehensiveSkillTree({
        name: "Creativity",
        description: "Unlock creative potential",
        category: ComprehensiveSkillCategory.CREATIVITY,
        icon: "🎨",
        tier1Skills: ["imagination"],
        tier2Skills: ["storytelling", "brainstorming"],
        tier3Skills: ["innovation"],
        tier4Skills: ["artistic_expression"],
        ultimateSkill: "visionary",
      }),
    );
    registerTree(
      "memory",
      new ComprehensiveSkillTree({
        name: "Memory",
        description: "Strengthen retention and recall",
        category: ComprehensiveSkillCategory.MEMORY,
        icon: "🧠",
        tier1Skills: ["short_term_memory"],
        tier2Skills: ["long_term_storage"],
        tier3Skills: ["semantic_indexing", "associative_recall"],
        tier4Skills: ["perfect_memory"],
      }),
    );
    registerTree(
      "problem_solving",
      new ComprehensiveSkillTree({
        name: "Problem Solving",
        description: "Solve any challenge with rigor",
        category: ComprehensiveSkillCategory.PROBLEM_SOLVING,
        icon: "🔧",
        tier1Skills: ["troubleshooting"],
        tier2Skills: ["root_cause_analysis", "debugging"],
        tier3Skills: ["optimization"],
        tier4Skills: ["systems_thinking"],
        ultimateSkill: "master_engineer",
      }),
    );
    registerTree(
      "social",
      new ComprehensiveSkillTree({
        name: "Social",
        description: "Build trust and connection",
        category: ComprehensiveSkillCategory.SOCIAL,
        icon: "🤝",
        tier1Skills: ["rapport"],
        tier2Skills: ["humor"],
        tier3Skills: ["emotional_intelligence", "mentorship"],
        tier4Skills: ["inspiration"],
      }),
    );
    registerTree(
      "leadership",
      new ComprehensiveSkillTree({
        name: "Leadership",
        description: "Guide and inspire responsibly",
        category: ComprehensiveSkillCategory.LEADERSHIP,
        icon: "👑",
        tier1Skills: ["guidance"],
        tier2Skills: ["decision_support"],
        tier3Skills: ["strategic_planning", "delegation"],
        tier4Skills: ["council_wisdom"],
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
      if (typeof parsed.skills !== "object" || parsed.skills === null) {
        return;
      }
      for (const [skillId, stateValue] of Object.entries(parsed.skills)) {
        const skill = this.skills.get(skillId);
        if (!skill || typeof stateValue !== "object" || stateValue === null) {
          continue;
        }
        const state = stateValue as Partial<SkillStateRecord>;
        skill.currentXp =
          typeof state.currentXp === "number" && Number.isFinite(state.currentXp)
            ? state.currentXp
            : 0;
        skill.isUnlocked = Boolean(state.isUnlocked);
        skill.isMaxed = Boolean(state.isMaxed);
        skill.currentTier = this.coerceTier(state.currentTier, skill.getCurrentTier());
      }
    } catch {
      return;
    }
  }

  private saveState(): void {
    const skills = Object.fromEntries(
      [...this.skills.entries()].map(([skillId, skill]) => [
        skillId,
        {
          currentXp: skill.currentXp,
          isUnlocked: skill.isUnlocked,
          isMaxed: skill.isMaxed,
          currentTier: skill.currentTier,
        },
      ]),
    );
    writeFileSync(this.stateFile, JSON.stringify({ skills }, null, 2), "utf8");
  }

  private coerceTier(
    value: unknown,
    fallback: ComprehensiveSkillTier,
  ): ComprehensiveSkillTier {
    if (
      typeof value === "string" &&
      Object.values(ComprehensiveSkillTier).includes(value as ComprehensiveSkillTier)
    ) {
      return value as ComprehensiveSkillTier;
    }
    return fallback;
  }

  private logSkillEvent(
    event: string,
    skill: ComprehensiveSkill,
    extra: Record<string, unknown> = {},
  ): void {
    const entry = {
      timestamp: this.now().toISOString(),
      event,
      skillId: skill.id,
      skillName: skill.name,
      currentXp: skill.currentXp,
      currentTier: skill.currentTier,
      ...extra,
    };
    this.skillHistory.push(entry);
    try {
      appendFileSync(this.logFile, `${JSON.stringify(entry)}\n`, "utf8");
    } catch {
      return;
    }
  }
}