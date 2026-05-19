/**
 * Outcome-weighted progression signals.
 *
 * Public-side port of the AGS gamification-economy block: rolling outcome
 * aggregation, multiplier computation, and economy policy (diminishing
 * returns, daily caps, TP sinks). Pure logic with no vendor coupling; layer
 * on top of OutcomeXPEngine and BrotherhoodSystem at the call site.
 */

export type OutcomeSignals = {
  success: boolean;
  latencyMs: number;
  errorRate: number;
  p95LatencyMs: number;
  userSatisfaction: number;
  retentionHint: number;
  novelty: number;
  governanceRisk: number;
};

export type XpMultiplierBreakdown = {
  base: number;
  successFactor: number;
  errorRatePenalty: number;
  latencyPenalty: number;
  satisfactionMultiplier: number;
  governanceRiskPenalty: number;
  noveltyBonus: number;
  clamped: number;
};

export type XpAward = {
  baseXp: number;
  multiplier: number;
  awardedXp: number;
  reason: string;
  breakdown: XpMultiplierBreakdown;
};

export type TpTx = {
  amount: number;
  reason: string;
  timestamp: string;
  metadata: Record<string, unknown>;
};

export type AggregatorOptions = {
  latencyWindow?: number;
  successWindow?: number;
  satisfactionWindow?: number;
};

export class OutcomeSignalAggregator {
  static readonly DEFAULT_LATENCY_WINDOW = 5_000;
  static readonly DEFAULT_SUCCESS_WINDOW = 5_000;
  static readonly DEFAULT_SATISFACTION_WINDOW = 2_000;

  private readonly latencies: number[] = [];
  private readonly successes: number[] = [];
  private readonly satisfactionScores: number[] = [];

  private readonly latencyWindow: number;
  private readonly successWindow: number;
  private readonly satisfactionWindow: number;

  constructor(options: AggregatorOptions = {}) {
    this.latencyWindow =
      options.latencyWindow ?? OutcomeSignalAggregator.DEFAULT_LATENCY_WINDOW;
    this.successWindow =
      options.successWindow ?? OutcomeSignalAggregator.DEFAULT_SUCCESS_WINDOW;
    this.satisfactionWindow =
      options.satisfactionWindow ??
      OutcomeSignalAggregator.DEFAULT_SATISFACTION_WINDOW;
  }

  ingestInteraction(
    success: boolean,
    latencyMs: number,
    satisfaction?: number,
  ): void {
    this.successes.push(success ? 1 : 0);
    if (this.successes.length > this.successWindow) {
      this.successes.shift();
    }

    this.latencies.push(Math.max(0, latencyMs));
    if (this.latencies.length > this.latencyWindow) {
      this.latencies.shift();
    }

    if (satisfaction !== undefined) {
      const clamped = Math.max(-1, Math.min(1, satisfaction));
      this.satisfactionScores.push(clamped);
      if (this.satisfactionScores.length > this.satisfactionWindow) {
        this.satisfactionScores.shift();
      }
    }
  }

  errorRate(): number {
    if (this.successes.length === 0) {
      return 0;
    }
    const total = this.successes.reduce((sum, value) => sum + value, 0);
    return 1 - total / this.successes.length;
  }

  p95LatencyMs(): number {
    if (this.latencies.length === 0) {
      return 0;
    }
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const idx = Math.max(
      0,
      Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1),
    );
    return sorted[idx];
  }

  satisfaction(): number {
    if (this.satisfactionScores.length === 0) {
      return 0;
    }
    const total = this.satisfactionScores.reduce(
      (sum, value) => sum + value,
      0,
    );
    return total / this.satisfactionScores.length;
  }

  sampleSize(): { successes: number; latencies: number; satisfaction: number } {
    return {
      successes: this.successes.length,
      latencies: this.latencies.length,
      satisfaction: this.satisfactionScores.length,
    };
  }
}

export class QualityMultiplierCalculator {
  static readonly MIN_MULTIPLIER = 0.25;
  static readonly MAX_MULTIPLIER = 2.5;

  compute(signals: OutcomeSignals): {
    multiplier: number;
    breakdown: XpMultiplierBreakdown;
  } {
    const base = 1;
    let multiplier = base;

    const successFactor = signals.success ? 1.05 : 0.6;
    multiplier *= successFactor;

    const errorRate = Math.max(0, Math.min(1, signals.errorRate));
    const errorRatePenalty = Math.max(0.4, 1 - 0.9 * errorRate);
    multiplier *= errorRatePenalty;

    const p95 = Math.max(0, signals.p95LatencyMs);
    const latencyPenalty =
      p95 > 0
        ? Math.max(0.5, Math.min(1, 1 / (1 + Math.sqrt(p95 / 250))))
        : 1;
    multiplier *= latencyPenalty;

    const satisfaction = Math.max(-1, Math.min(1, signals.userSatisfaction));
    const satisfactionMultiplier = 1 + 0.15 * satisfaction;
    multiplier *= satisfactionMultiplier;

    const governanceRisk = Math.max(0, Math.min(1, signals.governanceRisk));
    const governanceRiskPenalty = Math.max(0.5, 1 - 0.6 * governanceRisk);
    multiplier *= governanceRiskPenalty;

    const novelty = Math.max(0, Math.min(1, signals.novelty));
    const noveltyBonus = 1 + 0.05 * novelty;
    multiplier *= noveltyBonus;

    const clamped = Math.max(
      QualityMultiplierCalculator.MIN_MULTIPLIER,
      Math.min(QualityMultiplierCalculator.MAX_MULTIPLIER, multiplier),
    );

    return {
      multiplier: clamped,
      breakdown: {
        base,
        successFactor,
        errorRatePenalty,
        latencyPenalty,
        satisfactionMultiplier,
        governanceRiskPenalty,
        noveltyBonus,
        clamped,
      },
    };
  }
}

export type EconomyPolicyOptions = {
  diminishingFactor?: number;
  minDiminishingMultiplier?: number;
  defaultDailyCap?: number;
  inflationCeilingTp?: number;
  inflationMaxMultiplier?: number;
};

type DailyBucket = {
  day: string;
  xp: number;
};

export class EconomyPolicy {
  static readonly DEFAULT_DIMINISHING_FACTOR = 0.08;
  static readonly DEFAULT_MIN_DIMINISHING = 0.35;
  static readonly DEFAULT_DAILY_CAP = 2_000;
  static readonly DEFAULT_INFLATION_CEILING_TP = 200_000;
  static readonly DEFAULT_INFLATION_MAX = 1.5;

  private readonly diminishingFactor: number;
  private readonly minDiminishing: number;
  private readonly defaultDailyCap: number;
  private readonly inflationCeilingTp: number;
  private readonly inflationMaxMultiplier: number;

  private readonly actionCounter = new Map<string, number>();
  private readonly dailyBuckets = new Map<string, DailyBucket>();

  constructor(options: EconomyPolicyOptions = {}) {
    this.diminishingFactor =
      options.diminishingFactor ?? EconomyPolicy.DEFAULT_DIMINISHING_FACTOR;
    this.minDiminishing =
      options.minDiminishingMultiplier ?? EconomyPolicy.DEFAULT_MIN_DIMINISHING;
    this.defaultDailyCap =
      options.defaultDailyCap ?? EconomyPolicy.DEFAULT_DAILY_CAP;
    this.inflationCeilingTp =
      options.inflationCeilingTp ?? EconomyPolicy.DEFAULT_INFLATION_CEILING_TP;
    this.inflationMaxMultiplier =
      options.inflationMaxMultiplier ?? EconomyPolicy.DEFAULT_INFLATION_MAX;
  }

  diminishingMultiplier(userId: string, actionType: string): number {
    const key = this.actionKey(userId, actionType);
    const count = this.actionCounter.get(key) ?? 0;
    return Math.max(this.minDiminishing, 1 / (1 + this.diminishingFactor * count));
  }

  recordAction(userId: string, actionType: string): void {
    const key = this.actionKey(userId, actionType);
    this.actionCounter.set(key, (this.actionCounter.get(key) ?? 0) + 1);
  }

  applyDailyCap(
    userId: string,
    actionFamily: string,
    xp: number,
    cap: number = this.defaultDailyCap,
  ): number {
    const key = this.bucketKey(userId, actionFamily);
    const today = this.dayKey();
    const existing = this.dailyBuckets.get(key);
    const bucket: DailyBucket =
      existing && existing.day === today ? existing : { day: today, xp: 0 };

    const remaining = Math.max(0, cap - bucket.xp);
    const awarded = Math.max(0, Math.min(Math.floor(xp), remaining));
    bucket.xp += awarded;
    this.dailyBuckets.set(key, bucket);
    return awarded;
  }

  dynamicTpPrice(baseTpCost: number, totalTpInCirculation: number): number {
    const fraction = Math.max(
      0,
      Math.min(1, totalTpInCirculation / this.inflationCeilingTp),
    );
    const inflation = 1 + fraction * (this.inflationMaxMultiplier - 1);
    return Math.ceil(baseTpCost * inflation);
  }

  tpSinkRerollQuest(): TpTx {
    return this.tpSink(-10, "quest_reroll", {});
  }

  tpSinkTempBuff(buffName: string): TpTx {
    return this.tpSink(-25, "temp_buff", { buff: buffName });
  }

  tpSinkAutonomyBudget(amount: number): TpTx {
    const debit = -Math.max(1, Math.floor(amount));
    return this.tpSink(debit, "autonomy_budget", {});
  }

  resetDailyBuckets(): void {
    this.dailyBuckets.clear();
  }

  resetActionCounts(): void {
    this.actionCounter.clear();
  }

  private tpSink(
    amount: number,
    reason: string,
    metadata: Record<string, unknown>,
  ): TpTx {
    return {
      amount,
      reason,
      metadata,
      timestamp: new Date().toISOString(),
    };
  }

  private actionKey(userId: string, actionType: string): string {
    return `${userId}::${actionType}`;
  }

  private bucketKey(userId: string, actionFamily: string): string {
    return `${userId}::${actionFamily}`;
  }

  private dayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }
}

export function computeAwardedXp(
  signals: OutcomeSignals,
  baseXp: number,
  options: {
    userId: string;
    actionType: string;
    actionFamily?: string;
    reason?: string;
    policy: EconomyPolicy;
    calculator?: QualityMultiplierCalculator;
    dailyCap?: number;
  },
): XpAward {
  const calc = options.calculator ?? new QualityMultiplierCalculator();
  const { multiplier, breakdown } = calc.compute(signals);

  options.policy.recordAction(options.userId, options.actionType);
  const diminish = options.policy.diminishingMultiplier(
    options.userId,
    options.actionType,
  );

  const combined = Math.max(0.1, Math.min(3, multiplier * diminish));
  const rawAwarded = Math.ceil(Math.max(0, baseXp) * combined);
  const family =
    options.actionFamily ?? (signals.success ? "general" : "reliability");
  const awardedXp = options.policy.applyDailyCap(
    options.userId,
    family,
    rawAwarded,
    options.dailyCap,
  );

  return {
    baseXp,
    multiplier: combined,
    awardedXp,
    reason: options.reason ?? "interaction",
    breakdown,
  };
}
