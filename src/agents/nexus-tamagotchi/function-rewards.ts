export type FunctionRewardConfig = {
  baseXp: number;
  baseTp: number;
  cooldownSeconds: number;
  description: string;
};

export type FunctionRewardContext = {
  streakDays?: number;
  firstOfDay?: boolean;
};

export type FunctionRewardResult = {
  xp: number;
  tp: number;
  awarded: boolean;
  reason: string;
  multiplier?: number;
};

export type FunctionRewardStats = {
  totalXp: number;
  totalTp: number;
  invocations: number;
  functionsUsed: number;
  topFunctions: Array<[string, number]>;
};

const REWARDS: Record<string, FunctionRewardConfig> = {
  interact: {
    baseXp: 15,
    baseTp: 5,
    cooldownSeconds: 0,
    description: 'Conversation interaction',
  },
  reflect: {
    baseXp: 25,
    baseTp: 10,
    cooldownSeconds: 300,
    description: 'Deep reflection',
  },
  store_memory: {
    baseXp: 10,
    baseTp: 3,
    cooldownSeconds: 60,
    description: 'Store memory',
  },
  recall_memory: {
    baseXp: 5,
    baseTp: 2,
    cooldownSeconds: 30,
    description: 'Recall memory',
  },
  learn: {
    baseXp: 20,
    baseTp: 8,
    cooldownSeconds: 120,
    description: 'Learn knowledge',
  },
  council_consult: {
    baseXp: 30,
    baseTp: 15,
    cooldownSeconds: 600,
    description: 'Consult council',
  },
  governance_decision: {
    baseXp: 40,
    baseTp: 20,
    cooldownSeconds: 300,
    description: 'Governance decision',
  },
  professor_query: {
    baseXp: 25,
    baseTp: 10,
    cooldownSeconds: 180,
    description: 'Query professors',
  },
  mission_complete: {
    baseXp: 100,
    baseTp: 50,
    cooldownSeconds: 0,
    description: 'Complete mission',
  },
  quest_complete: {
    baseXp: 75,
    baseTp: 35,
    cooldownSeconds: 0,
    description: 'Complete quest',
  },
  skill_unlock: {
    baseXp: 75,
    baseTp: 30,
    cooldownSeconds: 0,
    description: 'Unlock skill',
  },
  badge_earn: {
    baseXp: 100,
    baseTp: 40,
    cooldownSeconds: 0,
    description: 'Earn badge',
  },
};

export class FunctionRewardsMap {
  private readonly lastInvocation = new Map<string, number>();
  private readonly invocationCounts = new Map<string, number>();
  private totalXp = 0;
  private totalTp = 0;

  getReward(
    functionName: string,
    context: FunctionRewardContext = {},
  ): FunctionRewardResult {
    const config = REWARDS[functionName];
    if (!config) {
      return {
        xp: 0,
        tp: 0,
        awarded: false,
        reason: 'Unknown function',
      };
    }

    const now = Date.now();
    const previous = this.lastInvocation.get(functionName);
    if (previous !== undefined) {
      const elapsedSeconds = (now - previous) / 1000;
      if (elapsedSeconds < config.cooldownSeconds) {
        return {
          xp: 0,
          tp: 0,
          awarded: false,
          reason: 'Cooldown active',
        };
      }
    }

    let multiplier = 1;
    if (typeof context.streakDays === 'number') {
      const cappedStreak = Math.max(0, Math.min(context.streakDays, 7));
      multiplier += cappedStreak * 0.1;
    }
    if (context.firstOfDay === true) {
      multiplier += 0.25;
    }

    const xp = Math.floor(config.baseXp * multiplier);
    const tp = Math.floor(config.baseTp * multiplier);

    this.lastInvocation.set(functionName, now);
    this.invocationCounts.set(
      functionName,
      (this.invocationCounts.get(functionName) ?? 0) + 1,
    );
    this.totalXp += xp;
    this.totalTp += tp;

    return {
      xp,
      tp,
      awarded: true,
      reason: config.description,
      multiplier,
    };
  }

  getStats(): FunctionRewardStats {
    const topFunctions = [...this.invocationCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5);
    return {
      totalXp: this.totalXp,
      totalTp: this.totalTp,
      invocations: [...this.invocationCounts.values()].reduce(
        (total, value) => total + value,
        0,
      ),
      functionsUsed: this.invocationCounts.size,
      topFunctions,
    };
  }

  getAllFunctions(): Array<{
    name: string;
    baseXp: number;
    baseTp: number;
    cooldownSeconds: number;
    description: string;
    uses: number;
  }> {
    return Object.entries(REWARDS)
      .map(([name, config]) => ({
        name,
        baseXp: config.baseXp,
        baseTp: config.baseTp,
        cooldownSeconds: config.cooldownSeconds,
        description: config.description,
        uses: this.invocationCounts.get(name) ?? 0,
      }))
      .sort((left, right) => right.baseXp - left.baseXp);
  }
}

let functionRewardsInstance: FunctionRewardsMap | undefined;

export function getFunctionRewards(): FunctionRewardsMap {
  if (!functionRewardsInstance) {
    functionRewardsInstance = new FunctionRewardsMap();
  }
  return functionRewardsInstance;
}