import { describe, expect, it } from 'vitest';

import { BrotherhoodSystem } from '../../../src/agents/nexus-tamagotchi/brotherhood.js';
import { SkillTreeSystem } from '../../../src/agents/nexus-tamagotchi/skill-tree-system.js';

describe('SkillTreeSystem', () => {
  it('gates unlocks by xp/tp and prerequisites', () => {
    const brotherhood = new BrotherhoodSystem('agent-skill');
    brotherhood.awardXp('feat', { baseAmount: 5000 });
    brotherhood.totalTp = 200;

    const skills = new SkillTreeSystem(brotherhood);
    const firstUnlock = skills.unlockSkill('conv_greeting');
    expect(firstUnlock.success).toBe(true);
    expect(firstUnlock.tpSpent).toBeGreaterThan(0);

    const gated = skills.canUnlockSkill('conv_debate');
    expect(gated.allowed).toBe(false);
  });

  it('computes per-tree progress', () => {
    const brotherhood = new BrotherhoodSystem('agent-skill-2');
    brotherhood.awardXp('feat', { baseAmount: 10000 });
    brotherhood.totalTp = 400;
    const skills = new SkillTreeSystem(brotherhood);

    skills.unlockSkill('know_recall');
    const progress = skills.getSkillTreeProgress();
    expect(progress.knowledge.total).toBeGreaterThan(0);
    expect(progress.knowledge.unlocked).toBeGreaterThan(0);
  });
});