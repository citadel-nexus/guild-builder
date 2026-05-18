import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import type { DomainLearningEngine } from './domain-learning.js';
import type { LongTermMemory } from './long-term-memory.js';
import type { ShortTermMemoryBuffer } from './short-term-memory.js';

function parseNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export type IntegrationStatus = 'OK' | 'DEGRADED' | 'FAIL' | 'UNKNOWN';

export type IntegrationHealth = {
  name: string;
  status: IntegrationStatus;
  lastCheck: string;
  latencyMs?: number;
  errorMessage?: string;
  metadata: Record<string, unknown>;
};

export type CognitiveMetrics = {
  stmUsagePercent: number;
  ltmTotalEntries: number;
  learningVelocity: number;
  activeDomains: number;
  contextTokenUsage: number;
  memoryConsolidationPending: number;
  emotionalStability: number;
};

export type LearningInsights = {
  dominantDomain: string;
  learningTrend: 'growing' | 'stable' | 'declining';
  velocityChange: number;
  mostAccessedTopics: string[];
  knowledgeGaps: string[];
  recommendations: string[];
};

export type IntrospectionReport = {
  timestamp: string;
  agentId: string;
  agentName: string;
  stmEntryCount: number;
  stmOldestEntry?: string;
  ltmTotalVectors: number;
  ltmDomains: Record<string, number>;
  totalLearnings: number;
  recentLearnings: string[];
  learningVelocity: number;
  currentEmotion: string;
  emotionHistory: string[];
  emotionalStability: number;
  interactionsTotal: number;
  avgResponseQuality: number;
  xpTotal: number;
  rank: string;
  integrations: Record<string, IntegrationHealth>;
  selfDescription: string;
  capabilities: string[];
  limitations: string[];
};

export class SelfAwarenessModule {
  static readonly INTEGRATION_CHECKS: Record<
    string,
    {
      requiredKeys: string[];
    }
  > = {
    supabase: { requiredKeys: ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'] },
    openai: { requiredKeys: ['OPENAI_API_KEY'] },
    datadog: { requiredKeys: ['DD_API_KEY'] },
    posthog: { requiredKeys: ['POSTHOG_API_KEY'] },
    slack: { requiredKeys: ['SLACK_BOT_TOKEN'] },
    discord: { requiredKeys: ['DISCORD_BOT_TOKEN'] },
    linear: { requiredKeys: ['LINEAR_API_KEY'] },
    notion: { requiredKeys: ['NOTION_TOKEN'] },
    gitlab: { requiredKeys: ['GITLAB_TOKEN'] },
    github: { requiredKeys: ['GITHUB_TOKEN'] },
    stripe: { requiredKeys: ['STRIPE_SECRET_KEY'] },
  };

  static readonly AGENT_CAPABILITIES = [
    'Conversational AI with context awareness',
    'Semantic memory storage and retrieval (STM/LTM)',
    'Domain-separated learning with FAISS-style wrappers',
    'Multi-tier XP/TP gamification system',
    'Constitutional governance with audit trail',
    'Reflex auto-response engine',
    'Multi-channel broadcast contract support',
    'Context rehydration across sessions',
    'Self-awareness and introspection',
  ] as const;

  static readonly AGENT_LIMITATIONS = [
    'Semantic quality is bounded by synthetic embeddings in public mode',
    'Memory operations are local and not distributed',
    'Real-time integrations require external credential configuration',
    'Learning velocity depends on interaction frequency',
  ] as const;

  readonly agentId: string;
  readonly agentName: string;

  private readonly introspectionLogPath: string;
  private readonly integrationStatus: Record<string, IntegrationHealth> = {};
  private readonly emotionHistory: string[] = [];

  constructor(
    options: {
      agentId?: string;
      agentName?: string;
      stm?: ShortTermMemoryBuffer;
      ltm?: LongTermMemory;
      learningEngine?: DomainLearningEngine;
      performanceSnapshot?: {
        interactionsTotal?: number;
        avgResponseQuality?: number;
        xpTotal?: number;
        rank?: string;
      };
    } = {},
  ) {
    this.agentId = options.agentId ?? randomUUID();
    this.agentName = options.agentName ?? 'NexusAgent';
    this.stm = options.stm;
    this.ltm = options.ltm;
    this.learningEngine = options.learningEngine;
    this.performanceSnapshot = {
      interactionsTotal: options.performanceSnapshot?.interactionsTotal ?? 0,
      avgResponseQuality: options.performanceSnapshot?.avgResponseQuality ?? 0,
      xpTotal: options.performanceSnapshot?.xpTotal ?? 0,
      rank: options.performanceSnapshot?.rank ?? 'INITIATE',
    };
    const awarenessDir = join(process.cwd(), '.nexus_cache', 'awareness');
    mkdirSync(awarenessDir, { recursive: true });
    this.introspectionLogPath = join(awarenessDir, 'introspection_log.jsonl');
  }

  readonly stm?: ShortTermMemoryBuffer;
  readonly ltm?: LongTermMemory;
  readonly learningEngine?: DomainLearningEngine;
  private readonly performanceSnapshot: {
    interactionsTotal: number;
    avgResponseQuality: number;
    xpTotal: number;
    rank: string;
  };

  getIntegrationStatus(): Record<string, IntegrationHealth> {
    for (const [name, config] of Object.entries(
      SelfAwarenessModule.INTEGRATION_CHECKS,
    )) {
      this.integrationStatus[name] = this.checkIntegration(name, config.requiredKeys);
    }
    return structuredClone(this.integrationStatus);
  }

  getCognitiveLoad(): CognitiveMetrics {
    const metrics: CognitiveMetrics = {
      stmUsagePercent: 0,
      ltmTotalEntries: 0,
      learningVelocity: 0,
      activeDomains: 0,
      contextTokenUsage: 0,
      memoryConsolidationPending: 0,
      emotionalStability: 1,
    };

    if (this.stm) {
      const stats = this.stm.getStats();
      metrics.stmUsagePercent = parseNumber(stats.usagePercent, 0);
      metrics.memoryConsolidationPending =
        this.stm.getCandidatesForConsolidation().length;
    }

    if (this.ltm) {
      const stats = this.ltm.getStats();
      metrics.ltmTotalEntries = parseNumber(stats.totalEntries, 0);
      const domains = stats.domains;
      if (typeof domains === 'object' && domains !== null) {
        metrics.activeDomains = Object.keys(domains).length;
      }
    }

    if (this.learningEngine) {
      metrics.learningVelocity = this.learningEngine.getLearningVelocity(24);
    }

    if (this.emotionHistory.length > 0) {
      const recent = this.emotionHistory.slice(-10);
      const unique = new Set(recent).size;
      metrics.emotionalStability = Math.max(0, 1 - (unique - 1) / 10);
    }

    return metrics;
  }

  analyzeLearningPatterns(): LearningInsights {
    const insights: LearningInsights = {
      dominantDomain: 'general',
      learningTrend: 'stable',
      velocityChange: 0,
      mostAccessedTopics: [],
      knowledgeGaps: [],
      recommendations: [],
    };

    if (!this.learningEngine) {
      return insights;
    }

    const domainStats = this.learningEngine.getDomainStats();
    const values = Object.values(domainStats);
    if (values.length > 0) {
      values.sort((left, right) => right.totalLearnings - left.totalLearnings);
      insights.dominantDomain = values[0].domain;
      insights.mostAccessedTopics = values
        .sort((left, right) => right.avgAccessCount - left.avgAccessCount)
        .slice(0, 3)
        .map((item) => item.domain);
    }

    const currentVelocity = this.learningEngine.getLearningVelocity(24);
    const weeklyAverage = this.learningEngine.getLearningVelocity(168) / 7;
    if (weeklyAverage > 0) {
      insights.velocityChange = (currentVelocity - weeklyAverage) / weeklyAverage;
      if (insights.velocityChange > 0.2) {
        insights.learningTrend = 'growing';
      } else if (insights.velocityChange < -0.2) {
        insights.learningTrend = 'declining';
      }
    }

    if (currentVelocity < 0.1) {
      insights.recommendations.push(
        'Learning velocity is low; increase exploratory interactions.',
      );
    }
    if (insights.dominantDomain === 'general') {
      insights.recommendations.push(
        'Expand into specialized domains to diversify retained knowledge.',
      );
    }

    return insights;
  }

  introspect(): IntrospectionReport {
    const report: IntrospectionReport = {
      timestamp: new Date().toISOString(),
      agentId: this.agentId,
      agentName: this.agentName,
      stmEntryCount: 0,
      ltmTotalVectors: 0,
      ltmDomains: {},
      totalLearnings: 0,
      recentLearnings: [],
      learningVelocity: 0,
      currentEmotion:
        this.emotionHistory.length > 0
          ? this.emotionHistory[this.emotionHistory.length - 1]
          : 'neutral',
      emotionHistory: [...this.emotionHistory.slice(-10)],
      emotionalStability: 1,
      interactionsTotal: this.performanceSnapshot.interactionsTotal,
      avgResponseQuality: this.performanceSnapshot.avgResponseQuality,
      xpTotal: this.performanceSnapshot.xpTotal,
      rank: this.performanceSnapshot.rank,
      integrations: this.getIntegrationStatus(),
      selfDescription: '',
      capabilities: [...SelfAwarenessModule.AGENT_CAPABILITIES],
      limitations: [...SelfAwarenessModule.AGENT_LIMITATIONS],
    };

    if (this.stm) {
      const stats = this.stm.getStats();
      report.stmEntryCount = parseNumber(stats.totalEntries, 0);
      const recent = this.stm.getRecent(1);
      if (recent.length > 0) {
        report.stmOldestEntry = recent[0].timestamp;
      }
    }

    if (this.ltm) {
      const stats = this.ltm.getStats();
      report.ltmTotalVectors = parseNumber(stats.totalEntries, 0);
      const domains = stats.domains;
      if (typeof domains === 'object' && domains !== null) {
        for (const [domain, value] of Object.entries(
          domains as Record<string, unknown>,
        )) {
          const domainRecord = typeof value === 'object' && value !== null
            ? (value as Record<string, unknown>)
            : {};
          report.ltmDomains[domain] = parseNumber(domainRecord.entryCount, 0);
        }
      }
    }

    if (this.learningEngine) {
      const stats = this.learningEngine.getDomainStats();
      report.totalLearnings = Object.values(stats).reduce(
        (sum, value) => sum + value.totalLearnings,
        0,
      );
      report.learningVelocity = this.learningEngine.getLearningVelocity();
      report.recentLearnings = Object.values(stats)
        .filter((value) => value.recentLearnings > 0)
        .slice(0, 5)
        .map((value) => value.domain);
    }

    report.emotionalStability = this.getCognitiveLoad().emotionalStability;
    report.selfDescription = this.getSelfDescription();
    this.logIntrospection(report);
    return report;
  }

  getSelfDescription(): string {
    const cognitive = this.getCognitiveLoad();
    const integrations = this.getIntegrationStatus();
    const healthyCount = Object.values(integrations).filter(
      (integration) => integration.status === 'OK',
    ).length;

    return [
      `I am ${this.agentName}.`,
      `STM usage: ${Math.round(cognitive.stmUsagePercent)}%.`,
      `LTM entries: ${cognitive.ltmTotalEntries} across ${cognitive.activeDomains} domains.`,
      `Learning velocity: ${cognitive.learningVelocity.toFixed(2)} items/hour.`,
      `Integrations healthy: ${healthyCount}/${Object.keys(integrations).length}.`,
      `Emotional state: ${this.emotionHistory.length > 0 ? this.emotionHistory[this.emotionHistory.length - 1] : 'neutral'}.`,
    ].join(' ');
  }

  recordEmotion(emotion: string): void {
    this.emotionHistory.push(emotion);
    if (this.emotionHistory.length > 100) {
      this.emotionHistory.splice(0, this.emotionHistory.length - 50);
    }
  }

  private checkIntegration(
    name: string,
    requiredKeys: string[],
  ): IntegrationHealth {
    const startedAt = Date.now();
    const found = requiredKeys.find((key) => {
      const value = process.env[key];
      return typeof value === 'string' && value.length > 0;
    });
    const latencyMs = Date.now() - startedAt;

    if (found) {
      return {
        name,
        status: 'OK',
        lastCheck: new Date().toISOString(),
        latencyMs,
        metadata: { keyFound: found },
      };
    }

    return {
      name,
      status: 'FAIL',
      lastCheck: new Date().toISOString(),
      latencyMs,
      errorMessage: `Missing env: ${requiredKeys.join(', ')}`,
      metadata: {},
    };
  }

  private logIntrospection(report: IntrospectionReport): void {
    const payload = {
      timestamp: report.timestamp,
      agentId: report.agentId,
      stmCount: report.stmEntryCount,
      ltmTotal: report.ltmTotalVectors,
      learningVelocity: report.learningVelocity,
      emotionalStability: report.emotionalStability,
      integrationsHealthy: Object.values(report.integrations).filter(
        (integration) => integration.status === 'OK',
      ).length,
    };
    appendFileSync(this.introspectionLogPath, `${JSON.stringify(payload)}\n`, 'utf8');
  }
}