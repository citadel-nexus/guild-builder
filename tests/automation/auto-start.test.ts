// ─── CGRF Header ───────────────────────────────────────────────
// File:        tests/automation/auto-start.test.ts
// Stage:       11_COMMIT
// SRS:         SRS-CN-BUILDER-INTEGRATION-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-BUILDER-INTEGRATION-001
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-10-20
// Depends:     .bits/srs/SRS-CN-BUILDER-INTEGRATION-001.md, src/automation/auto-start.ts
// EnumType:    Test
// EnumEdges:   DEPENDS_ON .bits/srs/SRS-CN-BUILDER-INTEGRATION-001.md; VALIDATES src/automation/auto-start.ts
// DAG Node:    none
// Intent:      Preserve source-review regression coverage for the auto-start public contract.
// ───────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';

import { maybeStartResearchSignalPipe } from '../../src/automation/auto-start.js';

describe('maybeStartResearchSignalPipe', () => {
  it('does nothing when RESEARCH_SIGNAL_PIPE is not on', async () => {
    const result = await maybeStartResearchSignalPipe({});
    expect(result.started).toBe(false);
    expect(result.reason).toBe('RESEARCH_SIGNAL_PIPE != on');
  });

  it('reports missing NATS_URL when enabled', async () => {
    const result = await maybeStartResearchSignalPipe({
      RESEARCH_SIGNAL_PIPE: 'on',
    });
    expect(result.started).toBe(false);
    expect(result.reason).toMatch(/NATS_URL/);
  });

  it('reports missing inbound subject when enabled', async () => {
    const result = await maybeStartResearchSignalPipe({
      RESEARCH_SIGNAL_PIPE: 'on',
      NATS_URL: 'nats://localhost:4222',
    });
    expect(result.started).toBe(false);
    expect(result.reason).toMatch(/RESEARCH_PIPE_INBOUND_SUBJECT/);
  });

  it('reports missing outbound prefix when enabled', async () => {
    const result = await maybeStartResearchSignalPipe({
      RESEARCH_SIGNAL_PIPE: 'on',
      NATS_URL: 'nats://localhost:4222',
      RESEARCH_PIPE_INBOUND_SUBJECT: 'citadel.builder.analytics.signal',
    });
    expect(result.started).toBe(false);
    expect(result.reason).toMatch(/RESEARCH_PIPE_OUTBOUND_PREFIX/);
  });
});