import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  CAPSReflexTriggerGroup,
  ContextMappingStrategy,
  RehydrationSource,
  ZUpIntegrationRuntime,
  createCapsModuleMetadata,
  createCapsReflexDefinition,
  createContextNode,
} from "../../../src/agents/nexus-tamagotchi/z-up-integration.js";

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

describe("z-up-integration", () => {
  it("registers metadata and executes reflex triggers with xp gates", () => {
    const runtime = new ZUpIntegrationRuntime();
    runtime.registerModuleMetadata(
      createCapsModuleMetadata({
        fileName: "nlu-engine.ts",
        enumFamily: "NLU",
        reflexTriggerGroup: CAPSReflexTriggerGroup.CONTEXT_REBUILD,
        srsCode: "SRS-NEXUS-TAMAGOTCHI-001",
      }),
    );

    const reflex = createCapsReflexDefinition({
      name: "Context rebuild",
      triggerGroup: CAPSReflexTriggerGroup.CONTEXT_REBUILD,
      triggerEvent: "context.miss",
      actionCode: "rebuild_context()",
      fallbackMessage: "Could not rebuild context",
      xpGate: 100,
      cooldownSeconds: 60,
      maxRetries: 2,
      isActive: true,
    });
    runtime.registerReflex(reflex);

    const blocked = runtime.triggerReflex("context.miss", { currentXp: 10 });
    expect(blocked.triggered).toBe(false);

    const allowed = runtime.triggerReflex("context.miss", { currentXp: 500 });
    expect(allowed.triggered).toBe(true);
    expect(allowed.reflex?.executionCount).toBe(1);
  });

  it("maps related context nodes and reports runtime stats", () => {
    const runtime = new ZUpIntegrationRuntime({
      contextStrategy: ContextMappingStrategy.GRAPH_BASED,
    });
    runtime.contextEngine.addNode(
      createContextNode({
        nodeId: "a",
        content: "core memory",
        nodeType: "fact",
        enumTags: ["memory"],
        weight: 1,
      }),
    );
    runtime.contextEngine.addNode(
      createContextNode({
        nodeId: "b",
        content: "linked memory",
        nodeType: "event",
        enumTags: ["memory"],
        weight: 0.8,
      }),
    );
    runtime.contextEngine.connectNodes("a", "b");
    const related = runtime.contextEngine.findRelatedNodes("a");
    expect(related.map((node) => node.nodeId)).toContain("b");

    const stats = runtime.getStats();
    expect(stats.contextNodeCount).toBe(2);
  });

  it("rehydrates from registered sources and writes to ledger", async () => {
    const storageDir = mkdtempSync(join(tmpdir(), "nexus-caps-"));
    tempDirs.push(storageDir);
    const runtime = new ZUpIntegrationRuntime({
      ledgerPath: join(storageDir, "caps_ledger.jsonl"),
    });

    runtime.rehydrationEngine.registerSource(
      RehydrationSource.MEMORY_SNAPSHOT,
      () => ({
        itemsRestored: 5,
        metadata: { source: "snapshot-a" },
      }),
    );
    const result = await runtime.rehydrationEngine.rehydrate(
      RehydrationSource.MEMORY_SNAPSHOT,
    );
    expect(result.success).toBe(true);
    expect(result.itemsRestored).toBe(5);

    runtime.registerModuleMetadata(
      createCapsModuleMetadata({
        fileName: "response-pipeline.ts",
        enumFamily: "RESPONSE",
        reflexTriggerGroup: CAPSReflexTriggerGroup.SETUP_RECOVERY,
        srsCode: "SRS-NEXUS-TAMAGOTCHI-001",
      }),
    );
    expect(runtime.ledger.readAll().length).toBeGreaterThan(0);
  });
});