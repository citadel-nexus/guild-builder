import type { NexusAgentVitals } from './models.js';
import type { BrotherhoodSystem } from './brotherhood.js';

type InsightEventTracker = {
  trackEvent: (
    eventName: string,
    properties?: Record<string, unknown>,
    userId?: string,
  ) => Promise<void>;
};

export type InsightRecord = {
  id: string;
  title: string;
  description: string;
  category: string;
  confidence: number;
  timestamp: string;
};

export type GrowthSuggestion = {
  area: string;
  suggestion: string;
  priority: 'low' | 'medium' | 'high';
};

export type WeeklyReport = {
  periodStart: string;
  periodEnd: string;
  interactions: number;
  xpEarned: number;
  tpEarned: number;
  rankChanges: number;
  insights: InsightRecord[];
  suggestions: GrowthSuggestion[];
};

export class InsightEngine {
  readonly insights: InsightRecord[] = [];
  readonly reports: WeeklyReport[] = [];

  constructor(
    private readonly brotherhood: BrotherhoodSystem,
    private readonly integrations?: InsightEventTracker,
  ) {}

  analyzeInteractionPatterns(
    interactions: Array<Record<string, unknown>>,
  ): InsightRecord[] {
    const generated: InsightRecord[] = [];
    if (interactions.length > 10) {
      generated.push(
        this.makeInsight(
          'High Engagement Detected',
          `You had ${interactions.length} interactions recently.`,
          'engagement',
          0.9,
        ),
      );
    }

    if (interactions.length > 0) {
      generated.push(
        this.makeInsight(
          'Consistent Activity',
          'Recent interaction patterns indicate consistency.',
          'behavior',
          0.7,
        ),
      );
    }

    this.insights.push(...generated);
    return generated;
  }

  suggestGrowthAreas(
    vitals: NexusAgentVitals,
    skillsUnlocked: number,
  ): GrowthSuggestion[] {
    const suggestions: GrowthSuggestion[] = [];
    if (this.brotherhood.totalXp < 500) {
      suggestions.push({
        area: 'Progression',
        suggestion:
          'Keep interacting to build XP momentum toward the next rank threshold.',
        priority: 'high',
      });
    }
    if (skillsUnlocked < 3) {
      suggestions.push({
        area: 'Skills',
        suggestion:
          'Unlock additional skills with TP to expand runtime capabilities.',
        priority: 'medium',
      });
    }
    if (vitals.energyLevel < 0.3) {
      suggestions.push({
        area: 'Energy',
        suggestion:
          'Energy is low; consider shorter focused sessions to recover.',
        priority: 'high',
      });
    }
    return suggestions;
  }

  buildWeeklyReport(input: {
    periodStart: string;
    periodEnd: string;
    interactions: number;
    xpEarned: number;
    tpEarned: number;
    rankChanges: number;
    insights?: InsightRecord[];
    suggestions?: GrowthSuggestion[];
  }): WeeklyReport {
    const report: WeeklyReport = {
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      interactions: input.interactions,
      xpEarned: input.xpEarned,
      tpEarned: input.tpEarned,
      rankChanges: input.rankChanges,
      insights: input.insights ? [...input.insights] : [],
      suggestions: input.suggestions ? [...input.suggestions] : [],
    };
    this.reports.push(report);
    return report;
  }

  generateWeeklyReport(
    interactions: Array<Record<string, unknown>>,
    xpEarned: number,
    tpEarned: number,
    rankChanges: number = 0,
  ): WeeklyReport {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const insights = this.analyzeInteractionPatterns(interactions);
    const suggestions: GrowthSuggestion[] = [
      {
        area: 'Consistency',
        suggestion: 'Maintain daily interactions for streak bonuses.',
        priority: 'medium',
      },
    ];

    const report = this.buildWeeklyReport({
      periodStart: weekAgo.toISOString(),
      periodEnd: now.toISOString(),
      interactions: interactions.length,
      xpEarned,
      tpEarned,
      rankChanges,
      insights,
      suggestions,
    });

    if (this.integrations) {
      void this.integrations.trackEvent(
        'weekly_report_generated',
        {
          interactions: report.interactions,
          xp_earned: report.xpEarned,
          insights_count: report.insights.length,
        },
        'agent',
      );
    }

    return report;
  }

  private makeInsight(
    title: string,
    description: string,
    category: string,
    confidence: number,
  ): InsightRecord {
    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      description,
      category,
      confidence,
      timestamp: new Date().toISOString(),
    };
  }
}