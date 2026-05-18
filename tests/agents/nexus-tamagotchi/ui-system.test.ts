import { describe, expect, it } from "vitest";

import {
  AgentChatServer,
  ResponseLengthConfig,
  launchAgentUi,
} from "../../../src/agents/nexus-tamagotchi/ui-system.js";

describe("ResponseLengthConfig", () => {
  it("supports presets and custom overrides", () => {
    const config = new ResponseLengthConfig("concise");
    expect(config.maxTokens).toBe(150);
    expect(config.systemSuffix.length).toBeGreaterThan(0);

    config.setPreset("maximum");
    expect(config.maxTokens).toBe(8000);

    config.setCustom(321, "custom suffix");
    expect(config.maxTokens).toBe(321);
    expect(config.systemSuffix).toBe("custom suffix");
  });
});

describe("AgentChatServer", () => {
  it("handles init and message payloads", async () => {
    const server = new AgentChatServer({
      agentName: "Aurora",
      interact: async (input) => `echo:${input}`,
    });

    const initMessages = await server.handleMessage({
      type: "init",
      settings: { responsePreset: "detailed" },
    });
    expect(initMessages.some((message) => message.type === "status")).toBe(
      true,
    );
    expect(initMessages.some((message) => message.type === "info")).toBe(true);

    const responseMessages = await server.handleMessage({
      type: "message",
      content: "ping",
      sessionId: "s-1",
    });
    const response = responseMessages.find(
      (message) => message.type === "response",
    );
    expect(response).toBeDefined();
    if (response && response.type === "response") {
      expect(response.content).toContain("echo:ping");
    }
  });

  it("streams responses when streaming capability exists", async () => {
    const server = new AgentChatServer({
      generateResponseStreaming: async function* (_input: string) {
        yield "hello";
        yield " ";
        yield "world";
      },
    });

    const events: Array<{ type: string }> = [];
    for await (const event of server.processMessageStreaming("hello")) {
      events.push({ type: event.type });
    }

    expect(events.some((event) => event.type === "typing")).toBe(true);
    expect(events.some((event) => event.type === "stream_token")).toBe(true);
    expect(events.some((event) => event.type === "stream_complete")).toBe(true);
  });

  it("launches UI with helper", () => {
    const server = launchAgentUi(
      {
        agentName: "LaunchCheck",
      },
      { responsePreset: "balanced", autoOpen: false, port: 9898 },
    );
    const started = server.start();
    expect(started.port).toBe(9898);
    expect(started.html.includes("LaunchCheck")).toBe(true);
  });
});
