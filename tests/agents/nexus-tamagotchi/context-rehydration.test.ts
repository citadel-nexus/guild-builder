import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ContextRehydrator, type SessionState } from '../../../src/agents/nexus-tamagotchi/context-rehydration.js';
import { DomainLearningEngine } from '../../../src/agents/nexus-tamagotchi/domain-learning.js';
import { LongTermMemory } from '../../../src/agents/nexus-tamagotchi/long-term-memory.js';
import { ShortTermMemoryBuffer } from '../../../src/agents/nexus-tamagotchi/short-term-memory.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'nexus-rehydration-'));
  tempDirs.push(dir);
  const stm = new ShortTermMemoryBuffer({
    storagePath: join(dir, 'stm.jsonl'),
    maxEntries: 50,
    pruneToSize: 25,
  });
  const ltm = new LongTermMemory({
    storageDir: join(dir, 'ltm'),
    vectorDim: 16,
  });
  const learning = new DomainLearningEngine({
    storageDir: join(dir, 'learning'),
    ltm,
  });
  const rehydrator = new ContextRehydrator(
    stm,
    ltm,
    learning,
    join(dir, 'sessions'),
  );
  return { stm, ltm, learning, rehydrator };
}

describe('ContextRehydrator', () => {
  it('rehydrates context and restores sessions', async () => {
    const { stm, ltm, learning, rehydrator } = makeFixture();

    await stm.inject('User asked about deployment rollback strategy.', {
      emotion: 'curious',
      tags: ['deployment', 'rollback'],
    });
    ltm.store('Rollback strategy should include tested recovery checkpoints.', {
      domain: 'skills',
    });
    learning.learn('Document rollback runbooks for production incidents.', {}, 'facts');

    const context = await rehydrator.rehydrateContext('rollback strategy');
    expect(context.stmMemories.length).toBeGreaterThan(0);
    expect(context.ltmMemories.length).toBeGreaterThan(0);
    expect(context.totalContextTokens).toBeGreaterThan(0);

    const window = await rehydrator.buildContextWindow('rollback strategy');
    expect(window).toContain('Recent Memories');

    const session: SessionState = {
      sessionId: 'session-1',
      userId: 'user-1',
      startedAt: new Date().toISOString(),
      lastInteractionAt: new Date().toISOString(),
      conversationHistory: [{ role: 'user', content: 'Rollback strategy?' }],
      stmSnapshotIds: context.stmMemories.map((memory) => memory.id),
      relevantLtmIds: context.ltmMemories.map((memory) => memory.id),
      emotionalState: context.emotionalState,
      activeSkills: ['incident-response'],
      xpEarnedSession: 25,
      tpEarnedSession: 5,
      metadata: { source: 'test' },
    };
    rehydrator.saveSession(session);

    const restored = rehydrator.restoreSession('session-1');
    expect(restored?.sessionId).toBe('session-1');
    expect(rehydrator.getLatestSessionId()).toBe('session-1');
  });
});