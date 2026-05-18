import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MissionGenerator,
  Quest,
  QuestDifficulty,
  QuestEngine,
  QuestObjective,
  QuestReward,
  QuestStatus,
  QuestType,
} from "../../../src/agents/nexus-tamagotchi/advanced-quest-engine.js";

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

describe("advanced-quest-engine", () => {
  it("accepts quests, tracks progress, and claims rewards", () => {
    const storageDir = mkdtempSync(join(tmpdir(), "nexus-quest-"));
    tempDirs.push(storageDir);
    const engine = new QuestEngine({
      storageDir,
      now: () => new Date("2026-01-14T00:00:00.000Z"),
    });

    const quest = new Quest({
      name: "Interaction Sprint",
      description: "Complete two interactions",
      questType: QuestType.SIDE,
      difficulty: QuestDifficulty.EASY,
      objectives: [
        new QuestObjective({
          description: "Interact twice",
          objectiveType: "count",
          targetMetric: "interactions",
          targetValue: 2,
        }),
      ],
      reward: new QuestReward({ xp: 50, tp: 10 }),
      status: QuestStatus.AVAILABLE,
    });
    engine.activeQuests.set(quest.id, quest);

    const accepted = engine.acceptQuest(quest.id);
    expect(accepted.accepted).toBe(true);

    let completed = engine.updateProgress("interactions", 1);
    expect(completed.length).toBe(0);

    completed = engine.updateProgress("interactions", 1);
    expect(completed.length).toBe(1);
    expect(completed[0]?.status).toBe(QuestStatus.COMPLETED);

    const reward = engine.claimReward(quest.id);
    expect(reward.claimed).toBe(true);
    expect(reward.reward?.totalXp).toBeGreaterThan(0);
  });

  it("extracts mission context and generates missions", () => {
    const storageDir = mkdtempSync(join(tmpdir(), "nexus-mission-"));
    tempDirs.push(storageDir);
    const engine = new QuestEngine({ storageDir });
    const generator = new MissionGenerator(engine);
    const context = generator.extractContext(
      "Can you help me solve this deployment problem?",
      "Let's debug the pipeline failure.",
    );
    expect(context.intent).toBe("problem_solving");

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.1);
    const mission = generator.maybeGenerateMission(context);
    randomSpy.mockRestore();
    expect(mission).toBeDefined();
    expect(engine.getActiveQuests().length).toBeGreaterThan(0);
  });
});
