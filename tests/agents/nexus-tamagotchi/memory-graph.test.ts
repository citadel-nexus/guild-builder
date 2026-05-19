import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LongTermMemory } from "../../../src/agents/nexus-tamagotchi/long-term-memory.js";
import { MemoryGraphRenderer } from "../../../src/agents/nexus-tamagotchi/memory-graph.js";

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

describe("MemoryGraphRenderer", () => {
  it("builds graph and exports json/html payloads", () => {
    const dir = makeTempDir("nexus-memory-graph-");
    const ltm = new LongTermMemory({
      storageDir: dir,
      vectorDim: 16,
    });
    ltm.store("Incident postmortems should include rollback timelines.", {
      domain: "skills",
    });
    ltm.store("User prefers concise summaries with action items.", {
      domain: "user_preferences",
    });
    ltm.store("Deployment checks require production parity.", {
      domain: "facts",
    });

    const renderer = new MemoryGraphRenderer(ltm);
    const graph = renderer.buildGraph(0.1);
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.domainColors.skills).toBeTypeOf("string");

    const json = renderer.renderToJson();
    const parsed = JSON.parse(json) as {
      stats: { totalNodes: number; totalEdges: number };
    };
    expect(parsed.stats.totalNodes).toBeGreaterThan(0);
    expect(parsed.stats.totalEdges).toBeGreaterThanOrEqual(0);

    const html = renderer.renderToHtml();
    expect(html.includes("<html")).toBe(true);
    expect(html.includes("Brain Synapse Map")).toBe(true);

    const growth = renderer.getGrowthStats() as {
      totalMemories: number;
      domainDistribution: Record<string, number>;
    };
    expect(growth.totalMemories).toBeGreaterThan(0);
    expect(Object.keys(growth.domainDistribution).length).toBeGreaterThan(0);
  });
});
