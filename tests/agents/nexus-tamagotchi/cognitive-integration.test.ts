import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { integrateCognitiveSystems } from "../../../src/agents/nexus-tamagotchi/cognitive-integration.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

describe("integrateCognitiveSystems", () => {
  it("wires cognitive systems onto the agent surface", () => {
    const storageRoot = makeTempDir("nexus-cognitive-");
    const agent: any = {
      agentId: "agent-123",
      agentName: "Aurora",
    };

    const systems = integrateCognitiveSystems(agent, {
      storageRoot,
      workshopUrl: "http://workshop.local",
      workshopApiKey: "key",
    });

    expect(systems.stm).toBeDefined();
    expect(systems.ltm).toBeDefined();
    expect(systems.learningEngine).toBeDefined();
    expect(systems.rehydrator).toBeDefined();
    expect(systems.selfAwareness).toBeDefined();
    expect(systems.memoryRenderer).toBeDefined();
    expect(systems.workshop).toBeDefined();
    expect(systems.analytics).toBeDefined();
    expect(systems.automation).toBeDefined();
    expect(systems.responseConfig).toBeDefined();

    expect(agent.stm).toBeDefined();
    expect(agent.ltm).toBeDefined();
    expect(agent.contextRehydrator).toBeDefined();
    expect(agent.workshopIntegration).toBeDefined();
  });
});
