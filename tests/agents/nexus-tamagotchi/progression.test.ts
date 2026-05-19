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

  it('reports overall progress with loc and category data', () => {
    const sheet = new MCPProgressionSheet();
    const progress = sheet.getOverallProgress();

    expect(progress.totalCapabilities).toBe(Object.keys(CAPABILITIES).length);
    expect(progress.locEstimate).toBeGreaterThan(0);
    expect(progress.locActual).toBeGreaterThanOrEqual(0);
    expect(progress.toolsRegistered).toBe(TOOL_REGISTRY.length);
    expect(progress.byCategory.foundation.total).toBeGreaterThan(0);
  });

  it('captures cognitive frames and exports MCP manifest', () => {
    const sheet = new MCPProgressionSheet();
    const frame = sheet.captureCognitiveFrame('validate stage state');

    expect(frame.thought).toBe('validate stage state');
    expect(sheet.getFrames().length).toBe(1);

    const manifest = sheet.exportMcpManifest();
    expect(manifest.name).toBe('citadel-nexus-agent');
    expect(manifest.tools.length).toBe(TOOL_REGISTRY.length);
    expect(manifest.progression.totalCapabilities).toBe(
      Object.keys(CAPABILITIES).length,
    );
  });
});