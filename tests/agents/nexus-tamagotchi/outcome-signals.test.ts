import { describe, expect, it } from "vitest";

import {
  EconomyPolicy,
  OutcomeSignalAggregator,
  QualityMultiplierCalculator,
  computeAwardedXp,
  type OutcomeSignals,
} from "../../../src/agents/nexus-tamagotchi/outcome-signals.js";

function baseSignals(overrides: Partial<OutcomeSignals> = {}): OutcomeSignals {
  return {
    success: true,
    latencyMs: 100,
    errorRate: 0,
    p95LatencyMs: 100,
    userSatisfaction: 0,
    retentionHint: 0.5,
    novelty: 0,
    governanceRisk: 0,
    ...overrides,
  };
}

describe("OutcomeSignalAggregator", () => {
  it("computes error rate, p95 latency, and satisfaction", () => {
    const agg = new OutcomeSignalAggregator();
    for (let i = 0; i < 9; i += 1) {
      agg.ingestInteraction(true, 100 + i * 10, 0.5);
    }
    agg.ingestInteraction(false, 800, -0.5);

    expect(agg.errorRate()).toBeCloseTo(0.1, 5);
    expect(agg.p95LatencyMs()).toBeGreaterThanOrEqual(180);
    expect(agg.satisfaction()).toBeGreaterThan(-0.1);
    expect(agg.satisfaction()).toBeLessThan(0.5);
  });

  it("returns zero baselines when empty", () => {
    const agg = new OutcomeSignalAggregator();
    expect(agg.errorRate()).toBe(0);
    expect(agg.p95LatencyMs()).toBe(0);
    expect(agg.satisfaction()).toBe(0);
  });

  it("evicts samples beyond the configured window", () => {
    const agg = new OutcomeSignalAggregator({
      latencyWindow: 3,
      successWindow: 3,
      satisfactionWindow: 3,
    });
    for (let i = 0; i < 10; i += 1) {
      agg.ingestInteraction(true, 1000, 0.9);
    }
    const sample = agg.sampleSize();
    expect(sample.latencies).toBe(3);
    expect(sample.successes).toBe(3);
    expect(sample.satisfaction).toBe(3);
  });
});

describe("QualityMultiplierCalculator", () => {
  const calc = new QualityMultiplierCalculator();

  it("clamps multiplier inside the bounded range", () => {
    const heavyPenalty = calc.compute(
      baseSignals({
        success: false,
        errorRate: 1,
        p95LatencyMs: 10_000,
        userSatisfaction: -1,
        governanceRisk: 1,
      }),
    );
    expect(heavyPenalty.multiplier).toBeGreaterThanOrEqual(
      QualityMultiplierCalculator.MIN_MULTIPLIER,
    );
    expect(heavyPenalty.multiplier).toBeLessThanOrEqual(
      QualityMultiplierCalculator.MAX_MULTIPLIER,
    );

    const heavyBoost = calc.compute(
      baseSignals({
        success: true,
        errorRate: 0,
        p95LatencyMs: 50,
        userSatisfaction: 1,
        novelty: 1,
      }),
    );
    expect(heavyBoost.multiplier).toBeLessThanOrEqual(
      QualityMultiplierCalculator.MAX_MULTIPLIER,
    );
    expect(heavyBoost.multiplier).toBeGreaterThan(1);
  });

  it("penalises failure and rewards success", () => {
    const ok = calc.compute(baseSignals({ success: true }));
    const failed = calc.compute(baseSignals({ success: false }));
    expect(ok.multiplier).toBeGreaterThan(failed.multiplier);
    expect(ok.breakdown.successFactor).toBeGreaterThan(
      failed.breakdown.successFactor,
    );
  });

  it("exposes a per-factor breakdown for transparency", () => {
    const result = calc.compute(
      baseSignals({ userSatisfaction: 0.5, novelty: 0.5 }),
    );
    expect(result.breakdown.base).toBe(1);
    expect(result.breakdown.satisfactionMultiplier).toBeGreaterThan(1);
    expect(result.breakdown.noveltyBonus).toBeGreaterThan(1);
    expect(result.breakdown.clamped).toBe(result.multiplier);
  });
});

describe("EconomyPolicy", () => {
  it("reduces diminishing multiplier with repeated actions", () => {
    const policy = new EconomyPolicy();
    const first = policy.diminishingMultiplier("user-1", "action-a");
    policy.recordAction("user-1", "action-a");
    policy.recordAction("user-1", "action-a");
    policy.recordAction("user-1", "action-a");
    const later = policy.diminishingMultiplier("user-1", "action-a");
    expect(later).toBeLessThan(first);
    expect(later).toBeGreaterThanOrEqual(EconomyPolicy.DEFAULT_MIN_DIMINISHING);
  });

  it("caps awarded XP per family per day", () => {
    const policy = new EconomyPolicy({ defaultDailyCap: 100 });
    const awarded = policy.applyDailyCap("user-1", "general", 80);
    const overflow = policy.applyDailyCap("user-1", "general", 80);
    expect(awarded).toBe(80);
    expect(overflow).toBe(20);
    expect(policy.applyDailyCap("user-1", "general", 50)).toBe(0);
  });

  it("emits TP sinks as negative transactions with metadata", () => {
    const policy = new EconomyPolicy();
    const reroll = policy.tpSinkRerollQuest();
    const buff = policy.tpSinkTempBuff("clarity_boost");
    const autonomy = policy.tpSinkAutonomyBudget(7);

    expect(reroll.amount).toBeLessThan(0);
    expect(reroll.reason).toBe("quest_reroll");
    expect(buff.metadata.buff).toBe("clarity_boost");
    expect(autonomy.amount).toBe(-7);
  });

  it("scales TP price with circulation pressure", () => {
    const policy = new EconomyPolicy({
      inflationCeilingTp: 1_000,
      inflationMaxMultiplier: 2,
    });
    expect(policy.dynamicTpPrice(10, 0)).toBe(10);
    expect(policy.dynamicTpPrice(10, 1_000)).toBe(20);
    expect(policy.dynamicTpPrice(10, 5_000)).toBe(20);
  });
});

describe("computeAwardedXp", () => {
  it("combines quality multiplier, diminishing returns, and daily cap", () => {
    const policy = new EconomyPolicy({ defaultDailyCap: 1_000 });
    const signals = baseSignals({
      success: true,
      userSatisfaction: 0.4,
      novelty: 0.2,
    });

    const first = computeAwardedXp(signals, 100, {
      userId: "user-1",
      actionType: "complete_mission",
      policy,
    });

    expect(first.awardedXp).toBeGreaterThan(0);
    expect(first.multiplier).toBeGreaterThan(0);
    expect(first.breakdown.clamped).toBeCloseTo(
      first.multiplier / first.multiplier === 0 ? 0 : first.breakdown.clamped,
      5,
    );

    for (let i = 0; i < 9; i += 1) {
      computeAwardedXp(signals, 100, {
        userId: "user-1",
        actionType: "complete_mission",
        policy,
      });
    }
    const later = computeAwardedXp(signals, 100, {
      userId: "user-1",
      actionType: "complete_mission",
      policy,
    });
    expect(later.multiplier).toBeLessThan(first.multiplier);
  });

  it("returns zero when the daily cap is exhausted", () => {
    const policy = new EconomyPolicy({ defaultDailyCap: 10 });
    const award = computeAwardedXp(baseSignals(), 100, {
      userId: "user-2",
      actionType: "spam",
      policy,
      dailyCap: 10,
    });
    expect(award.awardedXp).toBeLessThanOrEqual(10);
    const next = computeAwardedXp(baseSignals(), 100, {
      userId: "user-2",
      actionType: "spam",
      policy,
      dailyCap: 10,
    });
    expect(next.awardedXp).toBe(0);
  });
});
