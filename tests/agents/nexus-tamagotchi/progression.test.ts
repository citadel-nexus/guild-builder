import { describe, expect, it } from 'vitest';

import {
  CAPABILITIES,
  MCPProgressionSheet,
  TOOL_REGISTRY,
} from '../../../src/agents/nexus-tamagotchi/progression.js';

describe('MCPProgressionSheet', () => {
  it('returns individual capabilities by id', () => {
    const sheet = new MCPProgressionSheet();
    const capability = sheet.getCapability('core_loop');
    expect(capability?.name).toBe('Agent Core Loop');
    expect(capability?.status).toBe('complete');
  });

  it('computes completion summary from capability registry', () => {
    const sheet = new MCPProgressionSheet();
    const summary = sheet.getCompletionSummary();
    expect(summary.total).toBe(Object.keys(CAPABILITIES).length);
    expect(summary.complete).toBeGreaterThan(0);
    expect(summary.completionPercentage).toBeGreaterThan(0);
  });

  it('returns category breakdown with averaged completion', () => {
    const sheet = new MCPProgressionSheet();
    const breakdown = sheet.getCategoryBreakdown();
    expect(breakdown.gamification.total).toBeGreaterThan(0);
    expect(breakdown.foundation.completionPercentage).toBeGreaterThanOrEqual(0);
    expect(breakdown.foundation.completionPercentage).toBeLessThanOrEqual(100);
  });

  it('filters tools by authority tier', () => {
    const sheet = new MCPProgressionSheet();
    const observeTools = sheet.getToolsForAuthority('OBSERVE');
    const executeTools = sheet.getToolsForAuthority('EXECUTE');

    expect(observeTools.length).toBeGreaterThan(0);
    expect(executeTools.length).toBeGreaterThanOrEqual(observeTools.length);
    expect(executeTools.some((tool) => tool.toolId === 'broadcast')).toBe(true);
    expect(TOOL_REGISTRY.length).toBeGreaterThanOrEqual(executeTools.length);
  });
});