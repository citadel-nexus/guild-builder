import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { DomainLearningEngine } from '../../../src/agents/nexus-tamagotchi/domain-learning.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeEngine(): DomainLearningEngine {
  const dir = mkdtempSync(join(tmpdir(), 'nexus-learning-'));
  tempDirs.push(dir);
  return new DomainLearningEngine({
    storageDir: dir,
  });
}

describe('DomainLearningEngine', () => {
  it('learns and recalls domain knowledge', () => {
    const engine = makeEngine();

    const learnedConversation = engine.learn(
      'User prefers concise daily summaries.',
      { source: 'test' },
      'conversation',
    );
    const learnedSkill = engine.learn(
      'Blue/green rollout lowers release risk.',
      { source: 'test' },
      'skills',
    );

    expect(learnedConversation.success).toBe(true);
    expect(learnedSkill.success).toBe(true);

    const recalls = engine.recall('concise summary', ['conversation'], 3);
    expect(recalls.length).toBeGreaterThan(0);
    expect(recalls[0]?.domain).toBe('conversation');

    const stats = engine.getDomainStats();
    expect(Object.keys(stats).length).toBeGreaterThan(0);
    expect(stats.conversation.totalLearnings).toBeGreaterThan(0);

    const velocity = engine.getLearningVelocity(24);
    expect(velocity).toBeGreaterThanOrEqual(0);
  });
});