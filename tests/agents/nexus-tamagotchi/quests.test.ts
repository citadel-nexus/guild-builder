import { describe, expect, it } from 'vitest';

import { BrotherhoodSystem } from '../../../src/agents/nexus-tamagotchi/brotherhood.js';
import { QuestSystem } from '../../../src/agents/nexus-tamagotchi/quests.js';

describe('QuestSystem', () => {
  it('creates daily quests and completes on progress thresholds', () => {
    const brotherhood = new BrotherhoodSystem('agent-quests');
    const quests = new QuestSystem(brotherhood);

    expect(quests.getActiveQuests().length).toBeGreaterThan(0);
    const rewards = quests.updateProgress('interactions', 10);
    expect(rewards.length).toBeGreaterThan(0);
    expect(quests.completedQuests.length).toBeGreaterThan(0);
  });

  it('supports generating weekly and epic challenges', () => {
    const brotherhood = new BrotherhoodSystem('agent-quests-2');
    const quests = new QuestSystem(brotherhood);

    const weekly = quests.generateWeeklyChallenge();
    const epic = quests.generateEpicChallenge();
    expect(weekly.questType).toBe('weekly');
    expect(epic.questType).toBe('epic');
  });
});