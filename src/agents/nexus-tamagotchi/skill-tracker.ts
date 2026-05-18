import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { SkillTreeSkill } from "./skill-tree-system.js";

type TrackedSkillStorage = {
  skills: TrackedSkillRecord[];
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = record[key];
  return typeof value === "number" ? value : undefined;
}

function readBoolean(
  record: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

function parseTrackedSkillRecord(
  value: unknown,
): TrackedSkillRecord | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const skillId = readString(value, "skillId");
  const skillName = readString(value, "skillName");
  const tree = readString(value, "tree");
  const tier = readNumber(value, "tier");
  if (!skillId || !skillName || !tree || tier === undefined) {
    return undefined;
  }

  return {
    skillId,
    skillName,
    tree,
    tier,
    unlockedAt: readString(value, "unlockedAt"),
    usageCount: readNumber(value, "usageCount") ?? 0,
    xpEarnedFromSkill: readNumber(value, "xpEarnedFromSkill") ?? 0,
    lastUsed: readString(value, "lastUsed"),
    masteryLevel: readNumber(value, "masteryLevel") ?? 0,
    isActive: readBoolean(value, "isActive") ?? true,
  };
}

export type TrackedSkillRecord = {
  skillId: string;
  skillName: string;
  tree: string;
  tier: number;
  unlockedAt?: string;
  usageCount: number;
  xpEarnedFromSkill: number;
  lastUsed?: string;
  masteryLevel: number;
  isActive: boolean;
};

export class TrackedSkill {
  readonly skillId: string;
  readonly skillName: string;
  readonly tree: string;
  readonly tier: number;
  unlockedAt?: string;
  usageCount: number;
  xpEarnedFromSkill: number;
  lastUsed?: string;
  masteryLevel: number;
  isActive: boolean;

  constructor(record: TrackedSkillRecord) {
    this.skillId = record.skillId;
    this.skillName = record.skillName;
    this.tree = record.tree;
    this.tier = record.tier;
    this.unlockedAt = record.unlockedAt;
    this.usageCount = record.usageCount;
    this.xpEarnedFromSkill = record.xpEarnedFromSkill;
    this.lastUsed = record.lastUsed;
    this.masteryLevel = record.masteryLevel;
    this.isActive = record.isActive;
  }

  recordUsage(xpEarned: number = 0): void {
    this.usageCount += 1;
    this.xpEarnedFromSkill += xpEarned;
    this.lastUsed = new Date().toISOString();
    if (this.usageCount >= 100) {
      this.masteryLevel = Math.min(100, this.masteryLevel + 1);
    }
  }

  toDict(): TrackedSkillRecord {
    return {
      skillId: this.skillId,
      skillName: this.skillName,
      tree: this.tree,
      tier: this.tier,
      unlockedAt: this.unlockedAt,
      usageCount: this.usageCount,
      xpEarnedFromSkill: this.xpEarnedFromSkill,
      lastUsed: this.lastUsed,
      masteryLevel: this.masteryLevel,
      isActive: this.isActive,
    };
  }
}

export type SkillTrackerStats = {
  totalSkills: number;
  totalUsage: number;
  totalXp: number;
  averageMastery: number;
  byTree: Record<string, { count: number; usage: number }>;
  mostUsed?: string;
};

export class SkillTracker {
  private readonly trackedSkills = new Map<string, TrackedSkill>();
  private readonly stateDir: string;

  constructor(
    readonly agentName: string,
    stateDir: string = join(".nexus_agent_data", agentName),
  ) {
    this.stateDir = stateDir;
    this.loadTrackedSkills();
  }

  trackSkill(
    skill: Pick<SkillTreeSkill, "id" | "name" | "tree" | "tier">,
  ): TrackedSkill {
    const tracked = new TrackedSkill({
      skillId: skill.id,
      skillName: skill.name,
      tree: skill.tree,
      tier: skill.tier,
      unlockedAt: new Date().toISOString(),
      usageCount: 0,
      xpEarnedFromSkill: 0,
      masteryLevel: 0,
      isActive: true,
    });
    this.trackedSkills.set(skill.id, tracked);
    this.saveTrackedSkills();
    return tracked;
  }

  recordSkillUsage(
    skillId: string,
    xpEarned: number = 0,
  ): TrackedSkill | undefined {
    const tracked = this.trackedSkills.get(skillId);
    if (!tracked) {
      return undefined;
    }
    tracked.recordUsage(xpEarned);
    this.saveTrackedSkills();
    return tracked;
  }

  getTrackedSkill(skillId: string): TrackedSkill | undefined {
    return this.trackedSkills.get(skillId);
  }

  getTrackedSkills(): TrackedSkill[] {
    return [...this.trackedSkills.values()];
  }

  getSkillStats(): SkillTrackerStats {
    const allSkills = [...this.trackedSkills.values()];
    if (allSkills.length === 0) {
      return {
        totalSkills: 0,
        totalUsage: 0,
        totalXp: 0,
        averageMastery: 0,
        byTree: {},
      };
    }

    const totalUsage = allSkills.reduce(
      (total, skill) => total + skill.usageCount,
      0,
    );
    const totalXp = allSkills.reduce(
      (total, skill) => total + skill.xpEarnedFromSkill,
      0,
    );
    const averageMastery =
      allSkills.reduce((total, skill) => total + skill.masteryLevel, 0) /
      allSkills.length;

    const byTree: Record<string, { count: number; usage: number }> = {};
    for (const skill of allSkills) {
      const existing = byTree[skill.tree] ?? { count: 0, usage: 0 };
      existing.count += 1;
      existing.usage += skill.usageCount;
      byTree[skill.tree] = existing;
    }

    const mostUsed = allSkills.reduce(
      (current, candidate) => {
        if (!current) {
          return candidate;
        }
        return candidate.usageCount > current.usageCount ? candidate : current;
      },
      undefined as TrackedSkill | undefined,
    );

    return {
      totalSkills: allSkills.length,
      totalUsage,
      totalXp,
      averageMastery: Number(averageMastery.toFixed(1)),
      byTree,
      mostUsed: mostUsed?.skillName,
    };
  }

  private loadTrackedSkills(): void {
    const path = join(this.stateDir, "tracked_skills.json");
    if (!existsSync(path)) {
      return;
    }

    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
      if (!isRecord(parsed) || !Array.isArray(parsed.skills)) {
        return;
      }

      for (const skillValue of parsed.skills) {
        const record = parseTrackedSkillRecord(skillValue);
        if (!record) {
          continue;
        }
        this.trackedSkills.set(record.skillId, new TrackedSkill(record));
      }
    } catch {
      return;
    }
  }

  private saveTrackedSkills(): void {
    mkdirSync(this.stateDir, { recursive: true });
    const path = join(this.stateDir, "tracked_skills.json");
    const storage: TrackedSkillStorage = {
      skills: [...this.trackedSkills.values()].map((tracked) =>
        tracked.toDict(),
      ),
      updatedAt: new Date().toISOString(),
    };
    writeFileSync(path, JSON.stringify(storage, null, 2), "utf8");
  }
}
