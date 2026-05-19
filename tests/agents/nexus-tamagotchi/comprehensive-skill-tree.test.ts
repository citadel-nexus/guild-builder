import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { BrotherhoodSystem } from "../../../src/agents/nexus-tamagotchi/brotherhood.js";
import {
  ComprehensiveSkillTier,
  ComprehensiveSkillTreeSystem,
} from "../../../src/agents/nexus-tamagotchi/comprehensive-skill-tree.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop();
    if (!directory) {
      continue;
    }
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("comprehensive-skill-tree", () => {
  it("gates unlocks by prerequisite tier and unlock costs", () => {
    const storageDir = mkdtempSync(join(tmpdir(), "nexus-skill-tree-"));
    tempDirs.push(storageDir);
    const brotherhood = new BrotherhoodSystem("skill-tree-agent");
    brotherhood.totalXp = 10_000;
    brotherhood.totalTp = 500;

    const system = new ComprehensiveSkillTreeSystem({
      storageDir,
      brotherhood,
    });

    const blocked = system.unlockSkill("active_listening");
    expect(blocked.success).toBe(false);
    expect(blocked.message).toContain("Requires");

    const tierUp = system.addSkillXp("greeting", 200);
    expect(tierUp.newTier).toBe(ComprehensiveSkillTier.APPRENTICE);

    const unlocked = system.unlockSkill("active_listening");
    expect(unlocked.success).toBe(true);
    expect(system.getUnlockedSkills().map((skill) => skill.id)).toContain(
      "active_listening",
    );
  });

  it("computes tree progress and available skills", () => {
    const storageDir = mkdtempSync(join(tmpdir(), "nexus-skill-tree-progress-"));
    tempDirs.push(storageDir);
    const brotherhood = new BrotherhoodSystem("skill-tree-progress-agent");
    brotherhood.totalXp = 25_000;
    brotherhood.totalTp = 1_000;

    const system = new ComprehensiveSkillTreeSystem({
      storageDir,
      brotherhood,
    });

    system.addSkillXp("greeting", 1_000);
    system.unlockSkill("active_listening");
    system.addSkillXp("active_listening", 1_600);

    const progress = system.getSkillTreeProgress("conversation");
    expect(progress.totalSkills).toBeGreaterThan(0);
    expect(progress.skillsUnlocked).toBeGreaterThan(1);

    const available = system.getAvailableSkills();
    expect(available.length).toBeGreaterThan(0);
    expect(
      available.some((skill) => skill.id === "empathy"),
    ).toBe(true);

    const bonuses = system.getAllActiveBonuses();
    expect(Array.isArray(bonuses)).toBe(true);
  });
});