import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  AutoInstallationSystem,
  ensureAgentEnvironment,
  getAutoInstaller,
} from "../../../src/agents/nexus-tamagotchi/auto-installation.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nexus-installer-"));
  tempDirs.push(dir);
  return dir;
}

describe("AutoInstallationSystem", () => {
  it("scaffolds required directories/files and returns success payload", () => {
    const dir = makeTempDir();
    const installer = new AutoInstallationSystem(dir);
    const result = installer.runFullInstallationCheck();

    expect(result.directoriesCreated.length).toBeGreaterThan(0);
    expect(result.filesCreated.length).toBeGreaterThan(0);
    expect(["success", "partial"]).toContain(result.status);
    if (result.status === "success") {
      expect(result.xpAwarded).toBeGreaterThan(0);
    } else {
      expect(result.errors.length).toBeGreaterThan(0);
    }

    const missing = installer.getMissingDependencies();
    expect(missing.files.length).toBe(0);
  });

  it("supports singleton convenience helpers", () => {
    const dir = makeTempDir();
    const installer = getAutoInstaller(dir);
    const result = ensureAgentEnvironment(dir);

    expect(installer.installationLog.length).toBeGreaterThan(0);
    expect(result.timestamp.length).toBeGreaterThan(0);
  });
});
