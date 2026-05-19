import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { SkillTracker } from "../../../src/agents/nexus-tamagotchi/skill-tracker.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTracker(): { tracker: SkillTracker; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "nexus-skill-tracker-"));
  tempDirs.push(dir);
  return {
    tracker: new SkillTracker("Aurora", dir),
    dir,
  };
}

describe("SkillTracker", () => {
  it("tracks and records usage for unlocked skills", () => {
    const { tracker } = makeTracker();
    const tracked = tracker.trackSkill({
      id: "conv_greeting",
      name: "Greeting Mastery",
      tree: "conversation",
      tier: 1,
    });
    expect(tracked.skillId).toBe("conv_greeting");

    const updated = tracker.recordSkillUsage("conv_greeting", 15);
    expect(updated?.usageCount).toBe(1);
    expect(updated?.xpEarnedFromSkill).toBe(15);
  });

  it("persists tracked skills to disk between instances", () => {
    const { tracker, dir } = makeTracker();
    tracker.trackSkill({
      id: "know_recall",
      name: "Memory Recall",
      tree: "knowledge",
      tier: 1,
    });
    tracker.recordSkillUsage("know_recall", 30);

    const reloaded = new SkillTracker("Aurora", dir);
    const restored = reloaded.getTrackedSkill("know_recall");
    expect(restored?.usageCount).toBe(1);
    expect(restored?.xpEarnedFromSkill).toBe(30);
  });

  it("returns aggregate skill stats", () => {
    const { tracker } = makeTracker();
    tracker.trackSkill({
      id: "gov_policy",
      name: "Policy Understanding",
      tree: "governance",
      tier: 1,
    });
    tracker.recordSkillUsage("gov_policy", 10);
    tracker.recordSkillUsage("gov_policy", 20);

    const stats = tracker.getSkillStats();
    expect(stats.totalSkills).toBe(1);
    expect(stats.totalUsage).toBe(2);
    expect(stats.totalXp).toBe(30);
    expect(stats.byTree.governance.count).toBe(1);
  });
});
