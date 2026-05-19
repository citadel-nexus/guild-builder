import { describe, expect, it, vi } from "vitest";

import { WorkshopIntegration } from "../../../src/agents/nexus-tamagotchi/workshop.js";

describe("WorkshopIntegration", () => {
  it("registers tools and executes memory search handler", async () => {
    const integration = new WorkshopIntegration({
      stm: {
        search: async () => [
          {
            entry: { content: "stm memory", emotion: "focused" },
            similarity: 0.91,
          },
        ],
      },
      ltm: {
        retrieve: () => [
          {
            entry: { content: "ltm memory", domain: "skills" },
            similarity: 0.77,
          },
        ],
      },
    });

    const tools = integration.getRegisteredTools();
    expect(tools.length).toBeGreaterThanOrEqual(4);

    const output = await integration.invokeTool("nexus_memory_search", {
      query: "memory",
      topK: 5,
    });
    expect(output.count).toBe(2);
  });

  it("syncs memory payloads through configured transport", async () => {
    const post = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: {},
    });
    const integration = new WorkshopIntegration(
      {
        agentId: "agent-1",
        ltm: {
          entries: {
            general: {
              a: {
                content: "entry-a",
                domain: "general",
                createdAt: new Date().toISOString(),
                metadata: {},
              },
            },
          },
        },
        memoryRenderer: {
          renderToJson: () => JSON.stringify({ nodes: [], edges: [] }),
        },
      },
      {
        apiKey: "test",
        transport: { post },
      },
    );

    const result = await integration.syncToWorkshop();
    expect(result.success).toBe(true);
    expect(result.itemsSynced).toBeGreaterThanOrEqual(2);
    expect(post).toHaveBeenCalled();
  });

  it("falls back to local fetch when transport is unavailable", async () => {
    const integration = new WorkshopIntegration({
      ltm: {
        entries: {
          skills: {
            one: {
              content: "Use canary deploys for safer releases.",
              domain: "skills",
              createdAt: new Date().toISOString(),
              metadata: {},
            },
          },
        },
      },
    });

    const records = await integration.fetchFromWorkshop("canary", 5);
    expect(records.length).toBe(1);
    const status = integration.getSyncStatus() as { registeredTools: number };
    expect(status.registeredTools).toBeGreaterThanOrEqual(4);
  });
});
