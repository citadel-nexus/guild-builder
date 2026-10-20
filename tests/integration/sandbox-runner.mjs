// ─── CGRF Header ───────────────────────────────────────────────
// File:        tests/integration/sandbox-runner.mjs
// Stage:       11_COMMIT
// SRS:         SRS-CN-BUILDER-INTEGRATION-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-BUILDER-INTEGRATION-001
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-10-20
// Depends:     .bits/srs/SRS-CN-BUILDER-INTEGRATION-001.md, tests/integration/operations.checks.mjs
// EnumType:    Test
// EnumEdges:   DEPENDS_ON .bits/srs/SRS-CN-BUILDER-INTEGRATION-001.md; VALIDATES tests/integration/operations.checks.mjs
// DAG Node:    none
// Intent:      Run the operational regression suite with Node TypeScript transformation when the sandbox lacks the production compiler.
// ───────────────────────────────────────────────────────────────

import { readdirSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { spawnSync } from 'node:child_process';

// Node 24 runtime checks supplement CI's TypeScript build; they do not type-check.
const repo = fileURLToPath(new URL('../../', import.meta.url));
const source = join(repo, 'src');
const output = mkdtempSync(join(tmpdir(), 'builder-checks-'));

function transformDirectory(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      transformDirectory(path);
    } else if (entry.name.endsWith('.ts')) {
      const target = join(output, relative(source, path).replace(/\.ts$/, '.js'));
      const javascript = stripTypeScriptTypes(readFileSync(path, 'utf8'), { mode: 'transform' });
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, javascript);
    }
  }
}

try {
  transformDirectory(source);
  writeFileSync(join(output, 'package.json'), JSON.stringify({ type: 'module' }));
  const checks = readdirSync(join(repo, 'tests/integration'))
    .filter((name) => name.endsWith('.checks.mjs'))
    .map((name) => join(repo, 'tests/integration', name));
  const result = spawnSync(process.execPath, ['--test', ...checks], {
    cwd: repo,
    env: { ...process.env, BUILDER_DIST_ROOT: output },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(output, { recursive: true, force: true });
}
