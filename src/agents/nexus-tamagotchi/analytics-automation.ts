import { randomUUID } from "node:crypto";

export type AnalyticsEvent = {
  eventName: string;
  timestamp: string;
  properties: Record<string, unknown>;
  userId?: string;
  agentId?: string;
  sessionId?: string;
};

export type MetricPoint = {
  metricName: string;
  value: number;
  timestamp: string;
  tags: Record<string, string>;
  metricType: "gauge" | "counter" | "histogram";
};

export type AnalyticsTransport = {
  captureEvent?: (event: AnalyticsEvent) => void | Promise<void>;
  captureMetric?: (metric: MetricPoint) => void | Promise<void>;
};

export class AgentAnalytics {
  static readonly EVENT_TYPES = [
    "agent.interaction",
    "agent.memory.inject",
    "agent.memory.search",
    "agent.learning",
    "agent.xp.award",
    "agent.rank.change",
    "agent.badge.unlock",
    "agent.mission.complete",
    "agent.skill.unlock",
    "agent.error",
    "agent.session.start",
    "agent.session.end",
  ] as const;

  readonly agentId: string;

  readonly agentName: string;

  readonly enableDatadog: boolean;

  readonly enablePosthog: boolean;

  private readonly transport?: AnalyticsTransport;

  private readonly eventBuffer: AnalyticsEvent[] = [];

  private readonly metricBuffer: MetricPoint[] = [];

  private readonly bufferSize = 100;

  constructor(
    options: {
      agentId?: string;
      agentName?: string;
      enableDatadog?: boolean;
      enablePosthog?: boolean;
      transport?: AnalyticsTransport;
    } = {},
  ) {
    this.agentId = options.agentId ?? randomUUID();
    this.agentName = options.agentName ?? "NexusAgent";
    this.enableDatadog = options.enableDatadog ?? true;
    this.enablePosthog = options.enablePosthog ?? true;
    this.transport = options.transport;
  }

  async trackEvent(
    eventName: string,
    properties: Record<string, unknown> = {},
    userId?: string,
  ): Promise<void> {
    const event: AnalyticsEvent = {
      eventName,
      timestamp: new Date().toISOString(),
      properties: {
        ...properties,
        agentId: this.agentId,
        agentName: this.agentName,
      },
      userId,
      agentId: this.agentId,
    };
    this.eventBuffer.push(event);
    if (this.transport?.captureEvent) {
      await this.transport.captureEvent(event);
    }
    if (this.eventBuffer.length >= this.bufferSize) {
      this.flushEvents();
    }
  }

  async trackMetric(
    metricName: string,
    value: number,
    tags: Record<string, string> = {},
    metricType: "gauge" | "counter" | "histogram" = "gauge",
  ): Promise<void> {
    const metric: MetricPoint = {
      metricName,
      value,
      timestamp: new Date().toISOString(),
      tags: {
        ...tags,
        agentId: this.agentId,
        agentName: this.agentName,
      },
      metricType,
    };
    this.metricBuffer.push(metric);
    if (this.transport?.captureMetric) {
      await this.transport.captureMetric(metric);
    }
  }

  async trackInteraction(
    userInput: string,
    responseLength: number,
    responseTimeMs: number,
    xpEarned: number = 0,
  ): Promise<void> {
    await this.trackEvent("agent.interaction", {
      inputLength: userInput.length,
      responseLength,
      responseTimeMs,
      xpEarned,
    });
    await this.trackMetric(
      "agent.interaction.response_time",
      responseTimeMs,
      {},
      "histogram",
    );
    await this.trackMetric(
      "agent.interaction.response_length",
      responseLength,
      {},
      "gauge",
    );
    if (xpEarned > 0) {
      await this.trackMetric("agent.xp.earned", xpEarned, {}, "counter");
    }
  }

  async trackMemoryOperation(
    operation: "inject" | "search" | "consolidate",
    source: "stm" | "ltm",
    count: number = 1,
  ): Promise<void> {
    await this.trackEvent(`agent.memory.${operation}`, {
      source,
      count,
    });
    await this.trackMetric(
      `agent.memory.${operation}`,
      count,
      { source },
      "counter",
    );
  }

  async trackLearning(domain: string, contentLength: number): Promise<void> {
    await this.trackEvent("agent.learning", {
      domain,
      contentLength,
    });
    await this.trackMetric("agent.learning.count", 1, { domain }, "counter");
  }

  async trackRankChange(
    oldRank: string,
    newRank: string,
    totalXp: number,
  ): Promise<void> {
    await this.trackEvent("agent.rank.change", {
      oldRank,
      newRank,
      totalXp,
    });
  }

  async trackBadgeUnlock(badgeName: string, badgeXp: number): Promise<void> {
    await this.trackEvent("agent.badge.unlock", {
      badgeName,
      badgeXp,
    });
  }

  flushEvents(): void {
    this.eventBuffer.length = 0;
  }

  getStats(): Record<string, unknown> {
    return {
      agentId: this.agentId,
      datadogConnected: this.enableDatadog,
      posthogConnected: this.enablePosthog,
      eventsBuffered: this.eventBuffer.length,
      metricsBuffered: this.metricBuffer.length,
    };
  }
}

export type AutomationRule = {
  id: string;
  name: string;
  description: string;
  triggerEvent: string;
  conditions: Record<string, unknown>;
  actions: Array<Record<string, unknown>>;
  enabled: boolean;
  priority: number;
  cooldownSeconds: number;
  lastTriggered?: string;
};

type AutomationAgentSurfaces = {
  stm?: {
dd/bits/srs-nexus-tamagotchi-001-stage1
    getCandidatesForConsolidation?: () => unknown[];
  };
  ltm?: {
    consolidateFromStm?: (entries: unknown[]) => unknown;
  };
  workshopIntegration?: {
    syncToWorkshop?: () => Promise<unknown> | unknown;
  };
  broadcastIntegrations?: {
    broadcast?: (channel: string, payload: string) => Promise<void> | void;

    getCandidatesForConsolidation?(): unknown[];
  };
  ltm?: {
    consolidateFromStm?(entries: unknown[], threshold?: number): unknown;
  };
  workshopIntegration?: {
    syncToWorkshop?(): Promise<unknown> | unknown;
  };
  broadcastIntegrations?: {

  };
};

function parseNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

export class AutomationEngine {
  readonly agent: AutomationAgentSurfaces;

  private readonly rules = new Map<string, AutomationRule>();

  private readonly eventHandlers = new Map<string, AutomationRule[]>();

  private readonly executionLog: Array<Record<string, unknown>> = [];

  constructor(agent: AutomationAgentSurfaces) {
    this.agent = agent;
    this.registerDefaultRules();
  }

  registerRule(rule: Omit<AutomationRule, "id"> & { id?: string }): string {
    const id = rule.id ?? randomUUID();
    const normalized: AutomationRule = {
      id,
      name: rule.name,
      description: rule.description,
      triggerEvent: rule.triggerEvent,
      conditions: { ...rule.conditions },
      actions: [...rule.actions],
      enabled: rule.enabled,
      priority: rule.priority,
      cooldownSeconds: rule.cooldownSeconds,
      lastTriggered: rule.lastTriggered,
    };
    this.rules.set(id, normalized);
    const handlers = this.eventHandlers.get(normalized.triggerEvent) ?? [];
    handlers.push(normalized);
    handlers.sort((left, right) => right.priority - left.priority);
    this.eventHandlers.set(normalized.triggerEvent, handlers);
    return id;
  }

  async triggerEvent(
    eventName: string,
    eventData: Record<string, unknown>,
  ): Promise<void> {
    const handlers = this.eventHandlers.get(eventName) ?? [];
    for (const rule of handlers) {
      if (!rule.enabled) {
        continue;
      }
      if (this.isCoolingDown(rule)) {
        continue;
      }
      if (!this.checkConditions(rule.conditions, eventData)) {
        continue;
      }
      for (const action of rule.actions) {
        await this.executeAction(action, eventData);
      }
      rule.lastTriggered = new Date().toISOString();
      this.executionLog.push({
        ruleId: rule.id,
        ruleName: rule.name,
        event: eventName,
        timestamp: rule.lastTriggered,
      });
      if (this.executionLog.length > 1_000) {
        this.executionLog.splice(0, this.executionLog.length - 1_000);
      }
    }
  }

  getRules(): Array<Record<string, unknown>> {
    return Array.from(this.rules.values()).map((rule) => ({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      trigger: rule.triggerEvent,
      enabled: rule.enabled,
      lastTriggered: rule.lastTriggered ?? null,
    }));
  }

  getExecutionLog(limit: number = 50): Array<Record<string, unknown>> {
    const normalizedLimit = Math.max(1, Math.floor(limit));
    return this.executionLog.slice(-normalizedLimit);
  }

  private registerDefaultRules(): void {
    this.registerRule({
      name: "rank_up_broadcast",
      description: "Broadcast rank changes",
      triggerEvent: "rank_change",
      conditions: {},
      actions: [
        { type: "discord_broadcast", template: "rank_up" },
        { type: "slack_broadcast", template: "rank_up" },
      ],
      enabled: true,
      priority: 100,
      cooldownSeconds: 60,
    });

    this.registerRule({
      name: "badge_unlock_broadcast",
      description: "Broadcast badge unlock events",
      triggerEvent: "badge_unlock",
      conditions: {},
      actions: [{ type: "discord_broadcast", template: "badge" }],
      enabled: true,
      priority: 90,
      cooldownSeconds: 30,
    });

    this.registerRule({
      name: "auto_consolidate",
      description: "Consolidate STM to LTM when usage is high",
      triggerEvent: "stm_high_usage",
      conditions: {
        usagePercent: { gte: 80 },
      },
      actions: [{ type: "consolidate_memory" }],
      enabled: true,
      priority: 80,
      cooldownSeconds: 300,
    });

    this.registerRule({
      name: "auto_workshop_sync",
      description: "Sync workshop on significant learning burst",
      triggerEvent: "learning",
      conditions: {
        count: { gte: 10 },
      },
      actions: [{ type: "workshop_sync" }],
      enabled: true,
      priority: 70,
      cooldownSeconds: 600,
    });
  }

  private isCoolingDown(rule: AutomationRule): boolean {
    if (!rule.lastTriggered) {
      return false;
    }
    const previous = Date.parse(rule.lastTriggered);
    if (!Number.isFinite(previous)) {
      return false;
    }
    return Date.now() - previous < rule.cooldownSeconds * 1_000;
  }

  private checkConditions(
    conditions: Record<string, unknown>,
    data: Record<string, unknown>,
  ): boolean {
    for (const [key, condition] of Object.entries(conditions)) {
      const current = data[key];
      if (typeof condition === "object" && condition !== null) {
        const asRecord = condition as Record<string, unknown>;
        if (
          asRecord.gte !== undefined &&
          parseNumber(current, Number.NEGATIVE_INFINITY) <
            parseNumber(asRecord.gte, Number.NEGATIVE_INFINITY)
        ) {
          return false;
        }
        if (
          asRecord.lte !== undefined &&
          parseNumber(current, Number.POSITIVE_INFINITY) >
            parseNumber(asRecord.lte, Number.POSITIVE_INFINITY)
        ) {
          return false;
        }
        if (asRecord.eq !== undefined && current !== asRecord.eq) {
          return false;
        }
      } else if (current !== condition) {
        return false;
      }
    }
    return true;
  }

  private async executeAction(
    action: Record<string, unknown>,
    eventData: Record<string, unknown>,
  ): Promise<void> {
    const type = parseString(action.type, "");
    switch (type) {
      case "discord_broadcast":
      case "slack_broadcast": {
        const template = parseString(action.template, "default");
        const message = this.formatBroadcastMessage(template, eventData);
        await this.agent.broadcastIntegrations?.broadcast?.(type, message);
        break;
      }
      case "consolidate_memory": {
        const candidates =
          this.agent.stm?.getCandidatesForConsolidation?.() ?? [];
        if (candidates.length > 0) {
          this.agent.ltm?.consolidateFromStm?.(candidates);
        }
        break;
      }
      case "workshop_sync": {
        await this.agent.workshopIntegration?.syncToWorkshop?.();
        break;
      }
      default:
        break;
    }
  }

  private formatBroadcastMessage(
    template: string,
    data: Record<string, unknown>,
  ): string {
    switch (template) {
      case "rank_up":
        return `Rank updated: ${parseString(data.oldRank, "")} -> ${parseString(data.newRank, "")}`;
      case "badge":
        return `Badge unlocked: ${parseString(data.badgeName, "")}`;
      default:
        return JSON.stringify(data);
    }
  }
}
