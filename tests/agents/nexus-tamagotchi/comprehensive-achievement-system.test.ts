import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { BrotherhoodSystem } from "../../../src/agents/nexus-tamagotchi/brotherhood.js";
import { ComprehensiveAchievementSystem } from "../../../src/agents/nexus-tamagotchi/comprehensive-achievement-system.js";

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

describe("comprehensive-achievement-system", () => {
  it("unlocks qualifying badges and applies rewards", () => {
    const storageDir = mkdtempSync(join(tmpdir(), "nexus-badge-comprehensive-"));
    tempDirs.push(storageDir);
    const brotherhood = new BrotherhoodSystem("badge-comprehensive-agent");
    const system = new ComprehensiveAchievementSystem({
      storageDir,
      brotherhood,
    });

    const unlocked = system.checkAndUnlock({
      total_interactions: 120,
      current_streak: 7,
      questions_asked: 12,
    });
    const unlockedIds = unlocked.map((badge) => badge.id);
    expect(unlockedIds).toContain("first_words");
    expect(unlockedIds).toContain("conversationalist");
    expect(unlockedIds).toContain("dedicated");
    expect(brotherhood.totalXp).toBeGreaterThan(0);
    expect(brotherhood.totalTp).toBeGreaterThan(0);
  });

  it("updates badge progress and exposes summaries", () => {
    const storageDir = mkdtempSync(join(tmpdir(), "nexus-badge-summary-"));
    tempDirs.push(storageDir);
    const system = new ComprehensiveAchievementSystem({ storageDir });

    system.updateProgress({
      total_interactions: 40,
      current_streak: 2,
      trust_score: 5,
    });

    const summary = system.getBadgeSummary();
    expect(summary.totalBadges).toBeGreaterThan(0);
    expect(summary.unlockedBadges).toBeGreaterThanOrEqual(0);
    expect(system.getAvailableBadges().length).toBeGreaterThan(0);
  });
});