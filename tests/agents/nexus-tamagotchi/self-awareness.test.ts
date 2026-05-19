import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { DomainLearningEngine } from '../../../src/agents/nexus-tamagotchi/domain-learning.js';
import { LongTermMemory } from '../../../src/agents/nexus-tamagotchi/long-term-memory.js';
import { ShortTermMemoryBuffer } from '../../../src/agents/nexus-tamagotchi/short-term-memory.js';
import { SelfAwarenessModule } from '../../../src/agents/nexus-tamagotchi/self-awareness.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('SelfAwarenessModule', () => {
  it('produces cognitive metrics, insights, and introspection report', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nexus-awareness-'));
    tempDirs.push(dir);

    const stm = new ShortTermMemoryBuffer({
      storagePath: join(dir, 'stm.jsonl'),
      maxEntries: 50,
      pruneToSize: 25,
    });
    await stm.inject('We discussed memory consolidation tactics.', {
      emotion: 'curious',
      importance: 0.85,
    });

    const ltm = new LongTermMemory({
      storageDir: join(dir, 'ltm'),
      vectorDim: 16,
    });
    ltm.store('Consolidation threshold should be tuned per domain.', {
      domain: 'skills',
    });

    const learning = new DomainLearningEngine({
      storageDir: join(dir, 'learning'),
      ltm,
    });
    learning.learn('Track rehydration quality metrics over time.', {}, 'facts');

    const awareness = new SelfAwarenessModule({
      agentName: 'Aurora',
      stm,
      ltm,
      learningEngine: learning,
      performanceSnapshot: {
        interactionsTotal: 12,
        avgResponseQuality: 0.82,
        xpTotal: 320,
        rank: 'APPRENTICE',
      },
    });

    awareness.recordEmotion('curious');
    awareness.recordEmotion('focused');

    const load = awareness.getCognitiveLoad();
    expect(load.stmUsagePercent).toBeGreaterThanOrEqual(0);
    expect(load.ltmTotalEntries).toBeGreaterThan(0);

    const insights = awareness.analyzeLearningPatterns();
    expect(insights.dominantDomain.length).toBeGreaterThan(0);

    const report = awareness.introspect();
    expect(report.agentName).toBe('Aurora');
    expect(report.integrations.openai).toBeDefined();
    expect(report.capabilities.length).toBeGreaterThan(0);

    const description = awareness.getSelfDescription();
    expect(description).toContain('Aurora');
  });
});