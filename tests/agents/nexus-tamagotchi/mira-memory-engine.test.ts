import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  MiraAttentionMechanism,
  MiraAttentionWeightProfile,
  MiraContextRehydrator,
  MiraMemoryAnalyticsEngine,
  MiraMemoryConfig,
  MiraMemoryLearningAlgorithm,
  MiraMemorySystem,
  MiraSTMBuffer,
  MiraLTMManager,
  MiraSelfAwarenessModule,
  createMiraMemoryConfig,
} from "../../../src/agents/nexus-tamagotchi/mira-memory-engine.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeConfig(): MiraMemoryConfig {
  const dir = mkdtempSync(join(tmpdir(), "nexus-mira-"));
  tempDirs.push(dir);
  return createMiraMemoryConfig({
    storageBasePath: dir,
    stmFilename: "stm.jsonl",
    embeddingDimension: 16,
    stmMaxEntries: 64,
    stmPruneToSize: 32,
  });
}

describe("mira-memory-engine", () => {
  it("ingests into STM and retrieves merged STM/LTM results", () => {
    const config = makeConfig();
    const stm = new MiraSTMBuffer({ config });
    const ltm = new MiraLTMManager({ config });
    const system = new MiraMemorySystem({
      stm,
      ltm,
    });

    const ingestA = system.ingest({
      content:
        "User prefers concise release summaries for weekly status updates",
      userId: "u-1",
      tags: ["preference"],
    });
    const ingestB = system.ingest({
      content:
        "How to verify AGS governance routing and council confidence output",
      userId: "u-1",
      tags: ["procedural"],
    });

    expect(ingestA.stmEntryId.length).toBeGreaterThan(0);
    expect(ingestB.stmEntryId.length).toBeGreaterThan(0);

    const retrieved = system.retrieve("governance council confidence", 5);
    expect(retrieved.length).toBeGreaterThan(0);
    expect(retrieved[0].combinedScore).toBeGreaterThan(0);
  });

  it("supports attention rehydration and introspection surfaces", () => {
    const config = makeConfig();
    const stm = new MiraSTMBuffer({ config });
    const ltm = new MiraLTMManager({ config });
    const learner = new MiraMemoryLearningAlgorithm({ stm, ltm });
    const analytics = new MiraMemoryAnalyticsEngine({ stm, ltm, learner });
    const attention = new MiraAttentionMechanism(config);
    attention.setProfile(MiraAttentionWeightProfile.RELEVANCE_FOCUSED);

    const entry = stm.inject(
      "Remember to report degraded integration health to operator dashboard",
      {
        emotion: "curious",
        tags: ["operations"],
        userId: "u-2",
      },
    );
    expect(entry).toBeDefined();

    const rehydrator = new MiraContextRehydrator({
      stm,
      ltm,
      attention,
      sessionDir: join(config.storageBasePath, "sessions"),
    });
    const session = rehydrator.startSession({
      agentId: "agent-1",
      userId: "u-2",
      emotionalState: "focused",
    });
    const hydrated = rehydrator.rehydrateContext({
      query: "integration health report",
      sessionId: session.sessionId,
      maxMemories: 6,
    });
    expect(hydrated.rehydrated.length).toBeGreaterThan(0);

    const awareness = new MiraSelfAwarenessModule({
      agentId: "agent-1",
      agentName: "Nexus Agent",
      stm,
      ltm,
      analytics,
    });
    awareness.updateEmotion("focused");
    const report = awareness.introspect();
    expect(report.agentName).toBe("Nexus Agent");
    expect(report.currentEmotion).toBe("focused");
    expect(report.stmEntryCount).toBeGreaterThan(0);
  });
});
