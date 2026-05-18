import { randomUUID } from 'node:crypto';

import { BrotherhoodSystem } from './brotherhood.js';

export type QuestRuntimeType = 'daily' | 'weekly' | 'epic';

export type QuestRecord = {
  id: string;
  title: string;
  description: string;
  questType: QuestRuntimeType;
  xpReward: number;
  tpReward: number;
  requirements: Record<string, number>;
  progress: Record<string, number>;
  completed: boolean;
  expiresAt?: string;
};

export type QuestRewardRecord = {
  questId: string;
  xpEarned: number;
  tpEarned: number;
};

type QuestTemplate = {
  title: string;
  requirements: Record<string, number>;
  xp: number;
  tp: number;
};

const DAILY_TEMPLATES: QuestTemplate[] = [
  {
    title: 'Daily Conversation',
    requirements: { interactions: 3 },
    xp: 20,
    tp: 2,
  },
  {
    title: 'Knowledge Seeker',
    requirements: { questions: 2 },
    xp: 25,
    tp: 3,
  },
  {
    title: 'Reflective Moment',
    requirements: { reflections: 1 },
    xp: 30,
    tp: 3,
  },
];

const WEEKLY_TEMPLATES: QuestTemplate[] = [
  {
    title: 'Weekly Warrior',
    requirements: { interactions: 25 },
    xp: 100,
    tp: 10,
  },
  {
    title: 'Deep Thinker',
    requirements: { reflections: 5 },
    xp: 125,
    tp: 12,
  },
  {
    title: 'Memory Master',
    requirements: { memories: 20 },
    xp: 150,
    tp: 15,
  },
];

const EPIC_TEMPLATES: QuestTemplate[] = [
  {
    title: 'The Hundred',
    requirements: { interactions: 100 },
    xp: 500,
    tp: 50,
  },
  {
    title: 'Rank Ascension',
    requirements: { rank_ups: 1 },
    xp: 300,
    tp: 30,
  },
  {
    title: 'Skill Collector',
    requirements: { skills_unlocked: 5 },
    xp: 400,
    tp: 40,
  },
];

function buildProgress(requirements: Record<string, number>): Record<string, number> {
  const progress: Record<string, number> = {};
  for (const key of Object.keys(requirements)) {
    progress[key] = 0;
  }
  return progress;
}

export class QuestSystem {
  readonly activeQuests = new Map<string, QuestRecord>();
  readonly completedQuests: string[] = [];
  private templateCursor = 0;

  constructor(private readonly brotherhood: BrotherhoodSystem) {
    this.generateDailyQuests();
  }

  generateDailyQuests(): void {
    const today = new Date().toISOString().slice(0, 10);
    for (const [questId, quest] of this.activeQuests.entries()) {
      if (quest.questType === 'daily') {
        this.activeQuests.delete(questId);
      }
    }

    const selected = this.rotateTemplates(DAILY_TEMPLATES, 2);
    for (const template of selected) {
      const questId = `daily_${today}_${template.title.toLowerCase().replace(/\s+/g, '_')}`;
      this.activeQuests.set(questId, {
        id: questId,
        title: template.title,
        description: `Complete: ${JSON.stringify(template.requirements)}`,
        questType: 'daily',
        xpReward: template.xp,
        tpReward: template.tp,
        requirements: { ...template.requirements },
        progress: buildProgress(template.requirements),
        completed: false,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      });
    }
  }

  generateWeeklyChallenge(): QuestRecord {
    const template = this.rotateTemplates(WEEKLY_TEMPLATES, 1)[0];
    if (!template) {
      throw new Error('Weekly template unavailable');
    }
    const questId = `weekly_${new Date().toISOString().slice(0, 10)}`;
    const quest: QuestRecord = {
      id: questId,
      title: template.title,
      description: `Weekly: ${JSON.stringify(template.requirements)}`,
      questType: 'weekly',
      xpReward: template.xp,
      tpReward: template.tp,
      requirements: { ...template.requirements },
      progress: buildProgress(template.requirements),
      completed: false,
      expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    };
    this.activeQuests.set(quest.id, quest);
    return quest;
  }

  generateEpicChallenge(): QuestRecord {
    const template = this.rotateTemplates(EPIC_TEMPLATES, 1)[0];
    if (!template) {
      throw new Error('Epic template unavailable');
    }
    const quest: QuestRecord = {
      id: randomUUID(),
      title: template.title,
      description: `Epic: ${JSON.stringify(template.requirements)}`,
      questType: 'epic',
      xpReward: template.xp,
      tpReward: template.tp,
      requirements: { ...template.requirements },
      progress: buildProgress(template.requirements),
      completed: false,
    };
    this.activeQuests.set(quest.id, quest);
    return quest;
  }

  updateProgress(metric: string, value: number = 1): QuestRewardRecord[] {
    const rewards: QuestRewardRecord[] = [];
    for (const [questId, quest] of this.activeQuests.entries()) {
      if (quest.completed) {
        continue;
      }

      if (quest.expiresAt && new Date().toISOString() > quest.expiresAt) {
        quest.completed = true;
        continue;
      }

      for (const requirement of Object.keys(quest.requirements)) {
        if (!metric.includes(requirement) && !requirement.includes(metric)) {
          continue;
        }
        quest.progress[requirement] = (quest.progress[requirement] ?? 0) + value;
      }

      const isComplete = Object.entries(quest.requirements).every(
        ([key, target]) => (quest.progress[key] ?? 0) >= target,
      );
      if (!isComplete) {
        continue;
      }

      const reward = this.completeQuest(questId);
      if (reward) {
        rewards.push(reward);
      }
    }
    return rewards;
  }

  completeQuest(questId: string): QuestRewardRecord | undefined {
    const quest = this.activeQuests.get(questId);
    if (!quest || quest.completed) {
      return undefined;
    }

    quest.completed = true;
    this.completedQuests.push(questId);
    this.brotherhood.awardXp('feat', {
      baseAmount: quest.xpReward,
      reason: `Quest: ${quest.title}`,
    });

    return {
      questId,
      xpEarned: quest.xpReward,
      tpEarned: quest.tpReward,
    };
  }

  getActiveQuests(): QuestRecord[] {
    return [...this.activeQuests.values()].filter((quest) => !quest.completed);
  }

  private rotateTemplates(
    templates: readonly QuestTemplate[],
    count: number,
  ): QuestTemplate[] {
    if (templates.length === 0 || count <= 0) {
      return [];
    }
    const output: QuestTemplate[] = [];
    for (let index = 0; index < count; index += 1) {
      const template = templates[(this.templateCursor + index) % templates.length];
      output.push(template);
    }
    this.templateCursor = (this.templateCursor + count) % templates.length;
    return output;
  }
}