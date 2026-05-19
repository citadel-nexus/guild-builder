import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  DistributionFramework,
  readManagedServiceFile,
} from '../../../src/agents/nexus-tamagotchi/distribution.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeFramework(): DistributionFramework {
  const dir = mkdtempSync(join(tmpdir(), 'nexus-distribution-'));
  tempDirs.push(dir);
  return new DistributionFramework(
    {
      serviceName: 'nexus-agent-test',
      workingDir: dir,
    },
    {
      basePath: dir,
    },
  );
}

describe('DistributionFramework', () => {
  it('detects platform metadata and produces install artifacts', () => {
    const framework = makeFramework();
    const platform = framework.detectPlatform();
    expect(platform.serviceMethod.length).toBeGreaterThan(0);

    const install = framework.install();
    expect(install.success).toBe(true);
    expect(install.plannedFiles.length).toBe(1);
    expect(existsSync(install.plannedFiles[0])).toBe(true);

    const content = readManagedServiceFile(install.plannedFiles[0]);
    expect(content?.length).toBeGreaterThan(0);
  });

  it('reports status and supports uninstall cleanup', () => {
    const framework = makeFramework();
    framework.install();
    const before = framework.status();
    expect(before.installed).toBe(true);

    const uninstall = framework.uninstall();
    expect(uninstall.success).toBe(true);

    const after = framework.status();
    expect(after.installed).toBe(false);
  });
});