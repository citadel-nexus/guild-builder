import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ConfigurationManager,
  configurationFromDict,
  configurationFromEnv,
} from "../../../src/agents/nexus-tamagotchi/configuration-manager.js";

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

describe("configuration-manager", () => {
  it("normalizes dict input", () => {
    const config = configurationFromDict({
      agentName: "Atlas",
      maxTokens: 1024,
      enableUi: true,
      uiTheme: "light",
    });
    expect(config.agentName).toBe("Atlas");
    expect(config.maxTokens).toBe(1024);
    expect(config.enableUi).toBe(true);
    expect(config.uiTheme).toBe("light");
  });

  it("loads environment overrides", () => {
    const config = configurationFromEnv({
      NEXUS_AGENT_NAME: "Nova",
      NEXUS_MODEL: "gpt-4.1-mini",
      NEXUS_MAX_TOKENS: "2048",
      NEXUS_ENABLE_UI: "true",
    });
    expect(config.agentName).toBe("Nova");
    expect(config.model).toBe("gpt-4.1-mini");
    expect(config.maxTokens).toBe(2048);
    expect(config.enableUi).toBe(true);
  });

  it("persists and reloads configuration changes", () => {
    const storageDir = mkdtempSync(join(tmpdir(), "nexus-config-"));
    tempDirs.push(storageDir);
    const configPath = join(storageDir, "agent-config.json");
    const manager = new ConfigurationManager({
      configPath,
      env: {},
    });

    manager.set("agentName", "Cinder");
    manager.set("uiPort", 9001);

    const loaded = manager.load();
    expect(loaded.agentName).toBe("Cinder");
    expect(loaded.uiPort).toBe(9001);
  });
});
