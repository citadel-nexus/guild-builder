import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  AgentFAISSWrapper,
  LongTermMemory,
  type LTMEntry,
} from '../../../src/agents/nexus-tamagotchi/long-term-memory.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

describe('AgentFAISSWrapper', () => {
  it('supports insert/search/remove/rebuild and persistence', () => {
    const dir = makeTempDir('nexus-faiss-');
    const wrapper = new AgentFAISSWrapper('general', dir, 4);

    expect(wrapper.insert('v1', [0, 1, 0, 1], { kind: 'primary' })).toBe(true);
    expect(wrapper.insert('v2', [1, 0, 1, 0], { kind: 'secondary' })).toBe(true);
    expect(wrapper.insert('v3', [0, 1, 0, 1], { kind: 'duplicate' })).toBe(false);

    const beforeRemove = wrapper.search([0, 1, 0, 1], 2);
    expect(beforeRemove[0]?.vectorId).toBe('v1');

    expect(wrapper.remove('v1')).toBe(true);
    wrapper.rebuild();

    const afterRebuild = wrapper.search([0, 1, 0, 1], 2);
    expect(afterRebuild[0]?.vectorId).toBe('v2');

    wrapper.save();
    const reloaded = new AgentFAISSWrapper('general', dir, 4);
    const stats = reloaded.getStats() as { totalVectors: number };
    expect(stats.totalVectors).toBe(1);
  });
});

describe('LongTermMemory', () => {
  it('stores and retrieves domain memories and reports stats', () => {
    const dir = makeTempDir('nexus-ltm-');
    const ltm = new LongTermMemory({
      storageDir: dir,
      vectorDim: 16,
    });

    const prefId = ltm.store('User prefers concise architecture summaries.', {
      domain: 'user_preferences',
      metadata: { source: 'test' },
    });
    const skillId = ltm.store('Use staged rollouts to reduce deployment risk.', {
      domain: 'skills',
    });

    expect(prefId).toBeTypeOf('string');
    expect(skillId).toBeTypeOf('string');

    const userPrefResults = ltm.retrieve('concise summary preference', {
      domain: 'user_preferences',
      topK: 3,
    });
    expect(userPrefResults.length).toBeGreaterThan(0);
    expect(userPrefResults[0]?.entry.domain).toBe('user_preferences');

    const stmCandidate = {
      id: 'stm-1',
      timestamp: new Date().toISOString(),
      content: 'Document rollback procedures for production incidents.',
      emotion: 'curious',
      tags: ['incident', 'runbook'],
      source: 'interaction',
      context: 'conversation',
      importance: 0.9,
      consolidationScore: 0.95,
      metadata: {},
    };
    const consolidated = ltm.consolidateFromStm([stmCandidate], 0.8);
    expect(consolidated).toBe(1);

    const stats = ltm.getStats() as {
      totalEntries: number;
      domains: Record<string, { entryCount: number }>;
    };
    expect(stats.totalEntries).toBeGreaterThan(2);
    expect(stats.domains.user_preferences.entryCount).toBeGreaterThan(0);

    ltm.saveAll();
    const reloaded = new LongTermMemory({
      storageDir: dir,
      vectorDim: 16,
    });
    const reloadedResults = reloaded.retrieve('rollback procedures', { topK: 2 });
    expect(reloadedResults.length).toBeGreaterThan(0);
    const first = reloadedResults[0]?.entry as LTMEntry | undefined;
    expect(first?.content.length).toBeGreaterThan(0);
  });
});