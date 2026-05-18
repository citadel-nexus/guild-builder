import type { IntegrationsManager } from './integrations-manager.js';

export type OutcomeScore = {
  interactionId: string;
  baseXp: number;
  multiplier: number;
  finalXp: number;
  signals: Record<string, number>;
  timestamp: string;
};

const SIGNAL_WEIGHTS: Record<string, number> = {
  engagement_time: 0.2,
  return_rate: 0.2,
  satisfaction_score: 0.3,
  error_rate: -0.2,
  response_quality: 0.1,
};

export class OutcomeXPEngine {
  static readonly MIN_MULTIPLIER = 0.5;
  static readonly MAX_MULTIPLIER = 2;

  readonly scoreHistory: OutcomeScore[] = [];

  constructor(private readonly integrations?: IntegrationsManager) {}

  scoreInteraction(
    interactionId: string,
    baseXp: number,
    context: Record<string, unknown> = {},
  ): OutcomeScore {
    const signals = {
      response_quality: readNumber(context, 'coherence', 0.5),
      engagement_time: readNumber(context, 'session_duration', 0.5),
      return_rate: readNumber(context, 'is_returning_user', 0.5),
      satisfaction_score: readNumber(context, 'satisfaction', 0.7),
      error_rate: readNumber(context, 'errors', 0),
    };

    let multiplier = 1;
    for (const [signalName, weight] of Object.entries(SIGNAL_WEIGHTS)) {
      const value = signals[signalName] ?? 0.5;
      multiplier += (value - 0.5) * weight;
    }
    multiplier = Math.max(
      OutcomeXPEngine.MIN_MULTIPLIER,
      Math.min(OutcomeXPEngine.MAX_MULTIPLIER, multiplier),
    );

    const finalXp = Math.floor(baseXp * multiplier);
    const score: OutcomeScore = {
      interactionId,
      baseXp,
      multiplier,
      finalXp,
      signals,
      timestamp: new Date().toISOString(),
    };
    this.scoreHistory.push(score);

    if (this.integrations) {
      void this.integrations.trackEvent('outcome_scored', {
        interaction_id: interactionId,
        multiplier,
        final_xp: finalXp,
      });
    }

    return score;
  }

  getAverageMultiplier(): number {
    if (this.scoreHistory.length === 0) {
      return 1;
    }
    const total = this.scoreHistory.reduce(
      (sum, score) => sum + score.multiplier,
      0,
    );
    return total / this.scoreHistory.length;
  }
}

function readNumber(
  context: Record<string, unknown>,
  key: string,
  defaultValue: number,
): number {
  const value = context[key];
  return typeof value === 'number' ? value : defaultValue;
}