import { describe, expect, it, vi } from "vitest";

import {
  AgentAnalytics,
  AutomationEngine,
} from "../../../src/agents/nexus-tamagotchi/analytics-automation.js";

describe("AgentAnalytics", () => {
  it("tracks events and metrics through transport", async () => {
    const captureEvent = vi.fn();
    const captureMetric = vi.fn();
    const analytics = new AgentAnalytics({
      agentId: "agent-analytics",
      agentName: "AnalyticsAgent",
      transport: {
        captureEvent,
        captureMetric,
      },
    });

    await analytics.trackInteraction("hello", 42, 12, 5);
    await analytics.trackLearning("skills", 100);
    await analytics.trackBadgeUnlock("observer", 50);

    expect(captureEvent).toHaveBeenCalled();
    expect(captureMetric).toHaveBeenCalled();
    const stats = analytics.getStats() as {
      eventsBuffered: number;
      metricsBuffered: number;
    };
    expect(stats.eventsBuffered).toBeGreaterThan(0);
    expect(stats.metricsBuffered).toBeGreaterThan(0);
  });
});

describe("AutomationEngine", () => {
  it("executes matching rules and records executions", async () => {
    const broadcast = vi.fn();
    const consolidateFromStm = vi.fn();
    const syncToWorkshop = vi.fn().mockResolvedValue(undefined);

    const engine = new AutomationEngine({
      broadcastIntegrations: {
        broadcast,
      },
      stm: {
        getCandidatesForConsolidation: () => [{ id: "stm-1" }],
      },
      ltm: {
        consolidateFromStm,
      },
      workshopIntegration: {
        syncToWorkshop,
      },
    });

    await engine.triggerEvent("rank_change", {
      oldRank: "INITIATE",
      newRank: "APPRENTICE",
    });
    await engine.triggerEvent("stm_high_usage", {
      usagePercent: 90,
    });
    await engine.triggerEvent("learning", {
      count: 12,
    });

    expect(broadcast).toHaveBeenCalled();
    expect(consolidateFromStm).toHaveBeenCalled();
    expect(syncToWorkshop).toHaveBeenCalled();
    expect(engine.getExecutionLog(10).length).toBeGreaterThan(0);
  });
});
