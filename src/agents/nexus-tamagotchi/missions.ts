import { randomUUID } from 'node:crypto';

import { BrotherhoodSystem } from './brotherhood.js';

export type MissionType =
  | 'learning'
  | 'exploration'
  | 'social'
  | 'challenge'
  | 'daily'
  | 'weekly'
  | 'epic';

export type MissionRuntimeStatus =
  | 'available'
  | 'active'
  | 'completed'
  | 'failed'
  | 'expired';

type MissionRequirementValue = number | string;

export type MissionRecord = {
  id: string;
  title: string;
  description: string;
  missionType: MissionType;
  status: MissionRuntimeStatus;
  xpReward: number;
  tpReward: number;
  requirements: Record<string, MissionRequirementValue>;
  progress: Record<string, MissionRequirementValue>;
  createdAt: string;
  completedAt?: string;
  expiresAt?: string;
  linearIssueId?: string;
};

export type MissionRewardRecord = {
  missionId: string;
  xpEarned: number;
  tpEarned: number;
  rankUp: boolean;
  badgesUnlocked: string[];
};

type MissionTemplate = Omit<
  MissionRecord,
  'id' | 'status' | 'progress' | 'createdAt' | 'completedAt'
>;

const MISSION_TEMPLATES: Record<string, MissionTemplate> = {
  first_interaction: {
    title: 'First Words',
    description: 'Have your first conversation with the agent',
    missionType: 'learning',
    xpReward: 25,
    tpReward: 3,
    requirements: { interactions: 1 },
  },
  curious_mind: {
    title: 'Curious Mind',
    description: 'Ask 5 different questions',
    missionType: 'exploration',
    xpReward: 50,
    tpReward: 5,
    requirements: { questions: 5 },
  },
  dedicated_learner: {
    title: 'Dedicated Learner',
    description: 'Have 10 conversations in one session',
    missionType: 'learning',
    xpReward: 100,
    tpReward: 10,
    requirements: { interactions: 10 },
  },
  reflective_thinker: {
    title: 'Reflective Thinker',
    description: 'Trigger a reflection cycle',
    missionType: 'challenge',
    xpReward: 75,
    tpReward: 8,
    requirements: { reflections: 1 },
  },
  rank_achiever: {
    title: 'Rank Achiever',
    description: 'Reach APPRENTICE rank',
    missionType: 'epic',
    xpReward: 200,
    tpReward: 20,
    requirements: { rank: 'APPRENTICE' },
  },
  daily_check_in: {
    title: 'Daily Check-In',
    description: 'Have at least one interaction today',
    missionType: 'daily',
    xpReward: 15,
    tpReward: 2,
    requirements: { daily_interactions: 1 },
  },
  weekly_warrior: {
    title: 'Weekly Warrior',
    description: 'Complete 25 interactions this week',
    missionType: 'weekly',
    xpReward: 150,
    tpReward: 15,
    requirements: { weekly_interactions: 25 },
  },
};

function initProgress(
  requirements: Record<string, MissionRequirementValue>,
): Record<string, MissionRequirementValue> {
  const output: Record<string, MissionRequirementValue> = {};
  for (const [key, value] of Object.entries(requirements)) {
    output[key] = typeof value === 'number' ? 0 : '';
  }
  return output;
}

export class MissionEngine {
  readonly activeMissions = new Map<string, MissionRecord>();
  readonly completedMissions: string[] = [];

  constructor(private readonly brotherhood: BrotherhoodSystem) {
    this.initializeMissions();
  }

  updateProgress(metric: string, value: number = 1): MissionRewardRecord[] {
    const rewards: MissionRewardRecord[] = [];
    for (const [missionId, mission] of this.activeMissions.entries()) {
      if (mission.status !== 'available' && mission.status !== 'active') {
        continue;
      }
      if (mission.status === 'available') {
        mission.status = 'active';
      }

      for (const key of Object.keys(mission.requirements)) {
        if (!metric.includes(key) && !key.includes(metric)) {
          continue;
        }
        const current = mission.progress[key];
        if (typeof current === 'number') {
          mission.progress[key] = current + value;
        }
      }

      if (this.isCompleted(mission)) {
        const reward = this.completeMission(missionId);
        if (reward) {
          rewards.push(reward);
        }
      }
    }
    return rewards;
  }

  completeMission(missionId: string): MissionRewardRecord | undefined {
    const mission = this.activeMissions.get(missionId);
    if (!mission || mission.status === 'completed') {
      return undefined;
    }

    mission.status = 'completed';
    mission.completedAt = new Date().toISOString();
    this.completedMissions.push(missionId);

    const award = this.brotherhood.awardXp('feat', {
      baseAmount: mission.xpReward,
      reason: `Mission: ${mission.title}`,
    });
    return {
      missionId,
      xpEarned: mission.xpReward,
      tpEarned: mission.tpReward,
      rankUp: award.rankUp,
      badgesUnlocked: [],
    };
  }

  getActiveMissions(): MissionRecord[] {
    return [...this.activeMissions.values()].filter(
      (mission) => mission.status === 'available' || mission.status === 'active',
    );
  }

  getCompletedCount(): number {
    return this.completedMissions.length;
  }

  private initializeMissions(): void {
    for (const [templateId, template] of Object.entries(MISSION_TEMPLATES)) {
      this.activeMissions.set(templateId, {
        id: templateId,
        title: template.title,
        description: template.description,
        missionType: template.missionType,
        status: 'available',
        xpReward: template.xpReward,
        tpReward: template.tpReward,
        requirements: { ...template.requirements },
        progress: initProgress(template.requirements),
        createdAt: new Date().toISOString(),
        expiresAt: template.expiresAt,
        linearIssueId: template.linearIssueId,
      });
    }
  }

  private isCompleted(mission: MissionRecord): boolean {
    for (const [key, requirement] of Object.entries(mission.requirements)) {
      const progress = mission.progress[key];
      if (typeof requirement === 'number') {
        if (typeof progress !== 'number' || progress < requirement) {
          return false;
        }
        continue;
      }
      if (key === 'rank') {
        if (this.brotherhood.rank !== requirement) {
          return false;
        }
        continue;
      }
      if (progress !== requirement) {
        return false;
      }
    }
    return true;
  }
}

export function createMissionRecord(
  template: Omit<MissionRecord, 'id' | 'createdAt'>,
): MissionRecord {
  return {
    ...template,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
}