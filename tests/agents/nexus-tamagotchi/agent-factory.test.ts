import { describe, expect, it } from "vitest";

import {
  AgentFactory,
  type AgentTemplateConfig,
} from "../../../src/agents/nexus-tamagotchi/agent-factory.js";

type MockAgent = {
  name: string;
  config: AgentTemplateConfig;
};

describe("AgentFactory", () => {
  it("creates template-based agents and reuses existing entries", () => {
    const factory = new AgentFactory<MockAgent>((name, config) => ({
      name,
      config,
    }));

    const first = factory.createAgent("Aurora", { template: "enterprise" });
    const second = factory.createAgent("Aurora", { template: "default" });

    expect(first.config.model).toBe("gpt-4");
    expect(second).toBe(first);
    expect(factory.listAgents()).toContain("Aurora");
  });

  it("applies template overrides and supports destroy", () => {
    const factory = new AgentFactory<MockAgent>((name, config) => ({
      name,
      config,
    }));

    const agent = factory.createAgent("Nova", {
      template: "lightweight",
      overrides: {
        enableProfessors: true,
      },
    });
    expect(agent.config.enableCouncil).toBe(false);
    expect(agent.config.enableProfessors).toBe(true);
    expect(factory.destroyAgent("Nova")).toBe(true);
    expect(factory.getAgent("Nova")).toBeUndefined();
  });
});
