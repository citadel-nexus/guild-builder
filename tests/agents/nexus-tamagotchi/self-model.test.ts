import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  CapabilityDomain,
  CapabilityLevel,
  SelfModelSystem,
  SelfModelUpdateType,
} from "../../../src/agents/nexus-tamagotchi/self-model.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeStorage(): string {
  const dir = mkdtempSync(join(tmpdir(), "nexus-self-model-"));
  tempDirs.push(dir);
  return dir;
}

function makeSystem(agentId = "agent-a"): SelfModelSystem {
  return new SelfModelSystem({
    agentId,
    agentName: "Test Agent",
    storageDir: makeStorage(),
    autoLoad: false,
  });
}

describe("SelfModelSystem", () => {
  it("initialises every domain with baseline assessments", () => {
    const system = makeSystem();
    for (const domain of Object.values(CapabilityDomain)) {
      const cap = system.capabilities[domain];
      expect(cap).toBeDefined();
      expect(cap.confidence).toBeCloseTo(0.5, 5);
      expect(cap.notes).toContain("Initial baseline assessment");
      expect(cap.trend).toBe("stable");
    }
  });

  it("records interaction outcomes and updates trend after enough evidence", () => {
    const system = makeSystem();
    const baseline = system.getCapabilityLevel(CapabilityDomain.REASONING);

    for (let i = 0; i < 10; i += 1) {
      system.recordInteractionOutcome({
        domain: CapabilityDomain.REASONING,
        success: true,
        context: `interaction-${i}`,
      });
    }

    expect(system.getCapabilityLevel(CapabilityDomain.REASONING)).toBeGreaterThan(baseline);
    expect(system.getTotalInteractions()).toBe(10);
    expect(system.capabilities[CapabilityDomain.REASONING].trend).toBe("improving");
  });

  it("returns a level-change update when promotion fires", () => {
    const system = makeSystem();
    let update: ReturnType<SelfModelSystem["recordInteractionOutcome"]>;
    for (let i = 0; i < 10; i += 1) {
      update = system.recordInteractionOutcome({
        domain: CapabilityDomain.PLANNING,
        success: true,
      });
    }
    expect(update).toBeDefined();
    expect(update?.updateType).toBe(SelfModelUpdateType.CAPABILITY_INCREASE);
    expect(update?.domain).toBe(CapabilityDomain.PLANNING);
  });

  it("demotes after a sustained run of failures", () => {
    const system = makeSystem();
    const start = system.getCapabilityLevel(CapabilityDomain.CREATIVITY);
    for (let i = 0; i < 10; i += 1) {
      system.recordInteractionOutcome({
        domain: CapabilityDomain.CREATIVITY,
        success: false,
      });
    }
    const endLevel = system.getCapabilityLevel(CapabilityDomain.CREATIVITY);
    expect(endLevel).toBeLessThan(start);
    expect(endLevel).toBeGreaterThanOrEqual(CapabilityLevel.NOVICE);
  });

  it("dedupes a discovered limitation and accumulates context", () => {
    const system = makeSystem();
    const first = system.discoverLimitation({
      description: "Cannot reach external URLs",
      domain: CapabilityDomain.INTEGRATION,
      severity: "major",
      context: "Initial discovery during boot",
      workarounds: ["mock the response"],
    });
    const second = system.discoverLimitation({
      description: "cannot reach external urls",
      domain: CapabilityDomain.INTEGRATION,
      severity: "major",
      context: "Re-encountered during smoke test",
    });
    expect(second.id).toBe(first.id);
    expect(second.context).toContain("Initial discovery");
    expect(second.context).toContain("Re-encountered");
    expect(system.getActiveLimitations()).toHaveLength(1);
  });

  it("marks a limitation as overcome and records an update entry", () => {
    const system = makeSystem();
    const limitation = system.discoverLimitation({
      description: "Slow on long inputs",
      domain: CapabilityDomain.REASONING,
      severity: "moderate",
      context: "Manual probe",
    });
    expect(system.overcomeLimitation(limitation.id, "Optimised tokenizer")).toBe(true);
    expect(system.getActiveLimitations()).toHaveLength(0);
    expect(
      system.updateHistory.some(
        (entry) => entry.updateType === SelfModelUpdateType.LIMITATION_OVERCOME,
      ),
    ).toBe(true);
  });

  it("reinforces an existing strength on repeat identification", () => {
    const system = makeSystem();
    const first = system.identifyStrength({
      description: "Concise summaries",
      domain: CapabilityDomain.CONVERSATION,
      evidence: ["short reply"],
      confidence: 0.6,
    });
    const second = system.identifyStrength({
      description: "concise summaries",
      domain: CapabilityDomain.CONVERSATION,
      evidence: ["another short reply"],
    });
    expect(second.id).toBe(first.id);
    expect(second.confidence).toBeGreaterThan(first.confidence - 0.01);
    expect(second.evidence.length).toBeGreaterThanOrEqual(2);
    expect(second.usageCount).toBe(1);
  });

  it("clamps personality trait adjustments to [-1, 1]", () => {
    const system = makeSystem();
    system.updatePersonalityTrait("helpfulness", 5);
    expect(system.personality.helpfulness).toBe(1);
    system.updatePersonalityTrait("helpfulness", -10);
    expect(system.personality.helpfulness).toBe(-1);
    system.updatePersonalityTrait("does_not_exist", 0.5);
    expect(system.personality.does_not_exist).toBeUndefined();
  });

  it("counts behavioural patterns and surfaces dominant ones via the summary", () => {
    const system = makeSystem();
    for (let i = 0; i < 4; i += 1) {
      system.recordBehavioralPattern("clarifying_questions");
    }
    for (let i = 0; i < 2; i += 1) {
      system.recordBehavioralPattern("direct_responses");
    }
    const summary = system.getIntrospectionSummary();
    expect(summary.dominantBehaviors[0][0]).toBe("clarifying_questions");
    expect(summary.dominantBehaviors[0][1]).toBe(4);
  });

  it("renders a non-empty self description that references experience", () => {
    const system = makeSystem();
    for (let i = 0; i < 3; i += 1) {
      system.recordInteractionOutcome({
        domain: CapabilityDomain.CONVERSATION,
        success: true,
      });
    }
    const description = system.generateSelfDescription();
    expect(description).toContain("AI agent");
    expect(description).toContain("3 interactions");
  });

  it("persists snapshots to disk and reloads them on a new instance", () => {
    const storage = makeStorage();
    const writer = new SelfModelSystem({
      agentId: "agent-persist",
      storageDir: storage,
      autoLoad: false,
    });
    writer.discoverLimitation({
      description: "Needs vendor SDKs",
      domain: CapabilityDomain.INTEGRATION,
      severity: "minor",
      context: "Sandbox",
    });
    writer.identifyStrength({
      description: "Strict typing",
      domain: CapabilityDomain.TECHNICAL,
      evidence: ["clean tsc run"],
    });
    for (let i = 0; i < 5; i += 1) {
      writer.recordInteractionOutcome({
        domain: CapabilityDomain.TECHNICAL,
        success: true,
      });
    }
    writer.save();

    const reader = new SelfModelSystem({
      agentId: "agent-persist",
      storageDir: storage,
    });
    expect(reader.getTotalInteractions()).toBe(5);
    expect(reader.getActiveLimitations()).toHaveLength(1);
    expect(reader.strengths).toHaveLength(1);
    expect(reader.strengths[0].description).toBe("Strict typing");
  });
});
