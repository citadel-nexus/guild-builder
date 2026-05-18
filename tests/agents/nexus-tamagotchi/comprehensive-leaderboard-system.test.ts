import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ComprehensiveLeaderboardMetric,
  ComprehensiveLeaderboardSystem,
  ComprehensiveLeaderboardType,
} from "../../../src/agents/nexus-tamagotchi/comprehensive-leaderboard-system.js";

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

describe("comprehensive-leaderboard-system", () => {
  it("sorts users by selected metric", () => {
    const storageDir = mkdtempSync(join(tmpdir(), "nexus-leaderboard-comprehensive-"));
    tempDirs.push(storageDir);
    const system = new ComprehensiveLeaderboardSystem({ storageDir });

    system.updateUserStats("u1", "User One", { total_xp: 100, total_tp: 10 });
    system.updateUserStats("u2", "User Two", { total_xp: 250, total_tp: 20 });

    const board = system.getLeaderboard(
      ComprehensiveLeaderboardMetric.TOTAL_XP,
      ComprehensiveLeaderboardType.GLOBAL,
      10,
      0,
    );
    expect(board[0]?.userId).toBe("u2");
    expect(board[0]?.rank).toBe(1);
    expect(system.getUserRank("u1", ComprehensiveLeaderboardMetric.TOTAL_XP)?.rank).toBe(2);
  });

  it("handles competition join and finalization", () => {
    const storageDir = mkdtempSync(join(tmpdir(), "nexus-leaderboard-competition-"));
    tempDirs.push(storageDir);
    const now = new Date("2026-01-01T00:00:00.000Z");
    const system = new ComprehensiveLeaderboardSystem({
      storageDir,
      now: () => new Date(now),
    });

    system.updateUserStats("u1", "User One", { total_xp: 400 });
    system.updateUserStats("u2", "User Two", { total_xp: 200 });
    const competition = system.createCompetition({
      name: "XP Sprint",
      description: "One day XP race",
      metric: ComprehensiveLeaderboardMetric.TOTAL_XP,
      durationDays: 1,
    });

    expect(system.joinCompetition(competition.id, "u1").success).toBe(true);
    expect(system.joinCompetition(competition.id, "u2").success).toBe(true);

    const endedSystem = new ComprehensiveLeaderboardSystem({
      storageDir,
      now: () => new Date("2026-01-03T00:00:00.000Z"),
    });

    const result = endedSystem.finalizeCompetition(competition.id);
    expect(result.success).toBe(true);
    expect((result.winners as Array<{ place: number; userId: string }>)[0]?.userId).toBe(
      "u1",
    );
    expect(endedSystem.getActiveCompetitions().length).toBe(0);
  });
});