/**
 * Self-Model System.
 *
 * Public-side port of the AGS self-model block (Section 96): capability
 * tracking, limitations, strengths, personality traits, and behavioural
 * patterns. Persists to disk under storageDir as a single JSON snapshot.
 *
 * Complementary to SelfAwarenessModule (which probes runtime integration
 * health). This module tracks the agent's own perceived competencies and
 * how they evolve through evidence over time.
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export enum CapabilityDomain {
  CONVERSATION = "conversation",
  REASONING = "reasoning",
  MEMORY = "memory",
  LEARNING = "learning",
  CREATIVITY = "creativity",
  ANALYSIS = "analysis",
  PLANNING = "planning",
  EXECUTION = "execution",
  SOCIAL = "social",
  TECHNICAL = "technical",
  GOVERNANCE = "governance",
  INTEGRATION = "integration",
}

export enum CapabilityLevel {
  NOVICE = 1,
  APPRENTICE = 2,
  COMPETENT = 3,
  PROFICIENT = 4,
  EXPERT = 5,
  MASTER = 6,
}

export const CAPABILITY_LEVEL_NAME: Record<CapabilityLevel, string> = {
  [CapabilityLevel.NOVICE]: "NOVICE",
  [CapabilityLevel.APPRENTICE]: "APPRENTICE",
  [CapabilityLevel.COMPETENT]: "COMPETENT",
  [CapabilityLevel.PROFICIENT]: "PROFICIENT",
  [CapabilityLevel.EXPERT]: "EXPERT",
  [CapabilityLevel.MASTER]: "MASTER",
};

export enum SelfModelUpdateType {
  CAPABILITY_INCREASE = "capability_increase",
  CAPABILITY_DECREASE = "capability_decrease",
  LIMITATION_DISCOVERED = "limitation_discovered",
  LIMITATION_OVERCOME = "limitation_overcome",
  STRENGTH_IDENTIFIED = "strength_identified",
  WEAKNESS_IDENTIFIED = "weakness_identified",
  PATTERN_LEARNED = "pattern_learned",
  BEHAVIOR_ADJUSTED = "behavior_adjusted",
}

export type CapabilityTrend = "improving" | "stable" | "declining";

export type LimitationSeverity = "minor" | "moderate" | "major" | "critical";

export type CapabilityAssessment = {
  domain: CapabilityDomain;
  level: CapabilityLevel;
  confidence: number;
  evidenceCount: number;
  lastAssessed: string;
  recentSuccesses: number;
  recentFailures: number;
  trend: CapabilityTrend;
  notes: string[];
};

export type Limitation = {
  id: string;
  description: string;
  domain: CapabilityDomain;
  severity: LimitationSeverity;
  discoveredAt: string;
  context: string;
  workarounds: string[];
  isOvercome: boolean;
  overcomeAt?: string;
};

export type Strength = {
  id: string;
  description: string;
  domain: CapabilityDomain;
  confidence: number;
  evidence: string[];
  identifiedAt: string;
  usageCount: number;
  lastUsed?: string;
};

export type SelfModelUpdate = {
  id: string;
  timestamp: string;
  updateType: SelfModelUpdateType;
  domain?: CapabilityDomain;
  description: string;
  evidence: string;
  oldValue: unknown;
  newValue: unknown;
  confidence: number;
};

export type SelfModelSnapshot = {
  timestamp: string;
  agentId: string;
  capabilities: Record<string, CapabilityAssessment>;
  limitations: Limitation[];
  strengths: Strength[];
  personalityTraits: Record<string, number>;
  behavioralPatterns: Record<string, number>;
  totalInteractions: number;
  totalLearnings: number;
  version: string;
};

export type IntrospectionSummary = {
  agentId: string;
  totalInteractions: number;
  totalLearnings: number;
  capabilities: Record<
    string,
    { level: string; confidence: number; trend: CapabilityTrend }
  >;
  activeLimitations: number;
  overcomeLimitations: number;
  strengthsCount: number;
  topStrengths: string[];
  personality: Record<string, number>;
  dominantBehaviors: Array<[string, number]>;
  recentUpdates: number;
  selfDescription: string;
};

const DEFAULT_CAPABILITIES: Record<CapabilityDomain, CapabilityLevel> = {
  [CapabilityDomain.CONVERSATION]: CapabilityLevel.PROFICIENT,
  [CapabilityDomain.REASONING]: CapabilityLevel.COMPETENT,
  [CapabilityDomain.MEMORY]: CapabilityLevel.PROFICIENT,
  [CapabilityDomain.LEARNING]: CapabilityLevel.COMPETENT,
  [CapabilityDomain.CREATIVITY]: CapabilityLevel.APPRENTICE,
  [CapabilityDomain.ANALYSIS]: CapabilityLevel.COMPETENT,
  [CapabilityDomain.PLANNING]: CapabilityLevel.COMPETENT,
  [CapabilityDomain.EXECUTION]: CapabilityLevel.APPRENTICE,
  [CapabilityDomain.SOCIAL]: CapabilityLevel.COMPETENT,
  [CapabilityDomain.TECHNICAL]: CapabilityLevel.COMPETENT,
  [CapabilityDomain.GOVERNANCE]: CapabilityLevel.APPRENTICE,
  [CapabilityDomain.INTEGRATION]: CapabilityLevel.APPRENTICE,
};

const DEFAULT_PERSONALITY: Record<string, number> = {
  helpfulness: 0.8,
  curiosity: 0.7,
  patience: 0.9,
  assertiveness: 0.3,
  playfulness: 0.5,
  formality: 0.4,
  empathy: 0.7,
  thoroughness: 0.8,
};

const DEFAULT_BEHAVIORS: Record<string, number> = {
  direct_responses: 0,
  clarifying_questions: 0,
  multi_step_solutions: 0,
  creative_suggestions: 0,
  cautious_approaches: 0,
  confident_assertions: 0,
};

export type SelfModelOptions = {
  agentId: string;
  agentName?: string;
  storageDir?: string;
  autoLoad?: boolean;
};

export class SelfModelSystem {
  static readonly VERSION = "1.0";
  static readonly EVIDENCE_THRESHOLD = 10;
  static readonly PROMOTE_SUCCESS_RATE = 0.85;
  static readonly DEMOTE_FAILURE_RATE = 0.3;
  static readonly MIN_RECENT_FOR_DECISION = 5;
  static readonly DEFAULT_STORAGE_DIR = ".nexus_agent_data/self-model";

  readonly agentId: string;
  readonly agentName: string;
  readonly storageDir: string;
  readonly snapshotPath: string;

  readonly capabilities: Record<string, CapabilityAssessment> = {};
  readonly limitations: Limitation[] = [];
  readonly strengths: Strength[] = [];
  readonly personality: Record<string, number> = { ...DEFAULT_PERSONALITY };
  readonly behavioralPatterns: Record<string, number> = {
    ...DEFAULT_BEHAVIORS,
  };
  readonly updateHistory: SelfModelUpdate[] = [];

  private totalInteractions = 0;
  private totalLearnings = 0;

  constructor(options: SelfModelOptions) {
    this.agentId = options.agentId;
    this.agentName = options.agentName ?? options.agentId;
    this.storageDir = options.storageDir ?? SelfModelSystem.DEFAULT_STORAGE_DIR;
    this.snapshotPath = join(
      this.storageDir,
      `${this.agentId}_self_model.json`,
    );

    this.initializeCapabilities();

    if (options.autoLoad !== false) {
      this.load();
    }
  }

  private initializeCapabilities(): void {
    const now = new Date().toISOString();
    for (const [domain, level] of Object.entries(DEFAULT_CAPABILITIES) as Array<
      [CapabilityDomain, CapabilityLevel]
    >) {
      this.capabilities[domain] = {
        domain,
        level,
        confidence: 0.5,
        evidenceCount: 0,
        lastAssessed: now,
        recentSuccesses: 0,
        recentFailures: 0,
        trend: "stable",
        notes: ["Initial baseline assessment"],
      };
    }
  }

  recordInteractionOutcome(input: {
    domain: CapabilityDomain;
    success: boolean;
    context?: string;
    notes?: string;
  }): SelfModelUpdate | undefined {
    const cap = this.requireCapability(input.domain);
    const oldLevel = cap.level;

    if (input.success) {
      cap.recentSuccesses += 1;
    } else {
      cap.recentFailures += 1;
    }
    cap.evidenceCount += 1;
    cap.lastAssessed = new Date().toISOString();
    this.totalInteractions += 1;

    const totalRecent = cap.recentSuccesses + cap.recentFailures;
    const successRate = totalRecent > 0 ? cap.recentSuccesses / totalRecent : 0.5;

    if (successRate > 0.7) {
      cap.trend = "improving";
    } else if (successRate < 0.3) {
      cap.trend = "declining";
    } else {
      cap.trend = "stable";
    }

    let update: SelfModelUpdate | undefined;

    if (cap.evidenceCount >= SelfModelSystem.EVIDENCE_THRESHOLD) {
      const currentValue: number = cap.level;
      let nextValue: number = currentValue;

      if (
        successRate >= SelfModelSystem.PROMOTE_SUCCESS_RATE &&
        cap.recentSuccesses >= SelfModelSystem.MIN_RECENT_FOR_DECISION &&
        currentValue < CapabilityLevel.MASTER
      ) {
        nextValue = Math.min(currentValue + 1, CapabilityLevel.MASTER);
      } else if (
        successRate <= SelfModelSystem.DEMOTE_FAILURE_RATE &&
        cap.recentFailures >= SelfModelSystem.MIN_RECENT_FOR_DECISION &&
        currentValue > CapabilityLevel.NOVICE
      ) {
        nextValue = Math.max(currentValue - 1, CapabilityLevel.NOVICE);
      }

      if (nextValue !== currentValue) {
        cap.level = nextValue as CapabilityLevel;
        cap.confidence = Math.min(cap.confidence + 0.1, 1);
        cap.notes.push(
          `Level changed: ${CAPABILITY_LEVEL_NAME[oldLevel]} -> ${CAPABILITY_LEVEL_NAME[cap.level]} (success rate ${successRate.toFixed(2)})`,
        );
        cap.recentSuccesses = 0;
        cap.recentFailures = 0;

        const updateType =
          nextValue > currentValue
            ? SelfModelUpdateType.CAPABILITY_INCREASE
            : SelfModelUpdateType.CAPABILITY_DECREASE;
        update = {
          id: randomUUID(),
          timestamp: new Date().toISOString(),
          updateType,
          domain: input.domain,
          description: `Capability level changed in ${input.domain}`,
          evidence: input.context ?? "",
          oldValue: CAPABILITY_LEVEL_NAME[oldLevel],
          newValue: CAPABILITY_LEVEL_NAME[cap.level],
          confidence: cap.confidence,
        };
        this.updateHistory.push(update);
      }
    }

    if (input.notes) {
      cap.notes.push(input.notes);
    }
    cap.confidence = Math.min(0.5 + cap.evidenceCount * 0.01, 0.95);
    return update;
  }

  discoverLimitation(input: {
    description: string;
    domain: CapabilityDomain;
    severity: LimitationSeverity;
    context: string;
    workarounds?: string[];
  }): Limitation {
    const lowered = input.description.toLowerCase();
    for (const existing of this.limitations) {
      if (
        existing.description.toLowerCase() === lowered &&
        !existing.isOvercome
      ) {
        existing.context = existing.context
          ? `${existing.context}\n${input.context}`
          : input.context;
        if (input.workarounds && input.workarounds.length > 0) {
          existing.workarounds.push(...input.workarounds);
        }
        return existing;
      }
    }

    const limitation: Limitation = {
      id: randomUUID(),
      description: input.description,
      domain: input.domain,
      severity: input.severity,
      discoveredAt: new Date().toISOString(),
      context: input.context,
      workarounds: [...(input.workarounds ?? [])],
      isOvercome: false,
    };
    this.limitations.push(limitation);

    this.updateHistory.push({
      id: randomUUID(),
      timestamp: limitation.discoveredAt,
      updateType: SelfModelUpdateType.LIMITATION_DISCOVERED,
      domain: input.domain,
      description: `Limitation discovered: ${input.description}`,
      evidence: input.context,
      oldValue: undefined,
      newValue: input.description,
      confidence: 0.7,
    });

    return limitation;
  }

  overcomeLimitation(limitationId: string, evidence: string): boolean {
    for (const limitation of this.limitations) {
      if (limitation.id === limitationId && !limitation.isOvercome) {
        limitation.isOvercome = true;
        limitation.overcomeAt = new Date().toISOString();

        this.updateHistory.push({
          id: randomUUID(),
          timestamp: limitation.overcomeAt,
          updateType: SelfModelUpdateType.LIMITATION_OVERCOME,
          domain: limitation.domain,
          description: `Limitation overcome: ${limitation.description}`,
          evidence,
          oldValue: false,
          newValue: true,
          confidence: 0.8,
        });
        return true;
      }
    }
    return false;
  }

  identifyStrength(input: {
    description: string;
    domain: CapabilityDomain;
    evidence: string[];
    confidence?: number;
  }): Strength {
    const lowered = input.description.toLowerCase();
    for (const existing of this.strengths) {
      if (existing.description.toLowerCase() === lowered) {
        existing.evidence.push(...input.evidence);
        existing.confidence = Math.min(existing.confidence + 0.05, 1);
        existing.usageCount += 1;
        existing.lastUsed = new Date().toISOString();
        return existing;
      }
    }

    const strength: Strength = {
      id: randomUUID(),
      description: input.description,
      domain: input.domain,
      confidence: input.confidence ?? 0.7,
      evidence: [...input.evidence],
      identifiedAt: new Date().toISOString(),
      usageCount: 0,
    };
    this.strengths.push(strength);

    this.updateHistory.push({
      id: randomUUID(),
      timestamp: strength.identifiedAt,
      updateType: SelfModelUpdateType.STRENGTH_IDENTIFIED,
      domain: input.domain,
      description: `Strength identified: ${input.description}`,
      evidence: input.evidence.slice(0, 3).join("; "),
      oldValue: undefined,
      newValue: input.description,
      confidence: strength.confidence,
    });

    return strength;
  }

  updatePersonalityTrait(trait: string, delta: number): void {
    if (!(trait in this.personality)) {
      return;
    }
    const oldValue = this.personality[trait];
    this.personality[trait] = Math.max(-1, Math.min(1, oldValue + delta));

    if (Math.abs(delta) >= 0.1) {
      this.updateHistory.push({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        updateType: SelfModelUpdateType.BEHAVIOR_ADJUSTED,
        domain: undefined,
        description: `Personality trait adjusted: ${trait}`,
        evidence: "Interaction pattern analysis",
        oldValue,
        newValue: this.personality[trait],
        confidence: 0.6,
      });
    }
  }

  recordBehavioralPattern(pattern: string): void {
    this.behavioralPatterns[pattern] =
      (this.behavioralPatterns[pattern] ?? 0) + 1;
  }

  recordLearning(): void {
    this.totalLearnings += 1;
  }

  getCapabilityLevel(domain: CapabilityDomain): CapabilityLevel {
    return this.capabilities[domain]?.level ?? CapabilityLevel.NOVICE;
  }

  getActiveLimitations(domain?: CapabilityDomain): Limitation[] {
    const active = this.limitations.filter((lim) => !lim.isOvercome);
    return domain ? active.filter((lim) => lim.domain === domain) : active;
  }

  getTopStrengths(limit = 5): Strength[] {
    return [...this.strengths]
      .sort((left, right) => right.confidence - left.confidence)
      .slice(0, limit);
  }

  getTotalInteractions(): number {
    return this.totalInteractions;
  }

  getTotalLearnings(): number {
    return this.totalLearnings;
  }

  generateSelfDescription(): string {
    const proficientOrAbove = Object.values(this.capabilities)
      .filter((cap) => cap.level >= CapabilityLevel.PROFICIENT)
      .sort((left, right) => right.level - left.level)
      .slice(0, 3);

    const apprenticeOrBelow = Object.values(this.capabilities)
      .filter((cap) => cap.level <= CapabilityLevel.APPRENTICE)
      .sort((left, right) => left.level - right.level)
      .slice(0, 2);

    const parts: string[] = [
      `I am an AI agent with ${this.totalInteractions} interaction${this.totalInteractions === 1 ? "" : "s"} of experience.`,
    ];

    if (proficientOrAbove.length > 0) {
      const names = proficientOrAbove
        .map((cap) => cap.domain.replace(/_/g, " "))
        .join(", ");
      parts.push(`My strongest capabilities are in ${names}.`);
    }

    if (this.strengths.length > 0) {
      const top = this.getTopStrengths(1)[0];
      parts.push(`A particular strength is ${top.description.toLowerCase()}.`);
    }

    if (apprenticeOrBelow.length > 0) {
      const names = apprenticeOrBelow
        .map((cap) => cap.domain.replace(/_/g, " "))
        .join(", ");
      parts.push(`I am still developing my abilities in ${names}.`);
    }

    const active = this.getActiveLimitations();
    if (active.length > 0) {
      parts.push(
        `I am aware of ${active.length} current limitation${active.length === 1 ? "" : "s"} I am working to address.`,
      );
    }

    const dominantTraits = Object.entries(this.personality)
      .sort(
        (left, right) => Math.abs(right[1]) - Math.abs(left[1]),
      )
      .slice(0, 3);
    const traitDescs: string[] = [];
    for (const [trait, value] of dominantTraits) {
      if (value > 0.5) {
        traitDescs.push(`highly ${trait}`);
      } else if (value > 0) {
        traitDescs.push(`somewhat ${trait}`);
      }
    }
    if (traitDescs.length > 0) {
      parts.push(`I tend to be ${traitDescs.join(", ")}.`);
    }

    return parts.join(" ");
  }

  createSnapshot(): SelfModelSnapshot {
    return {
      timestamp: new Date().toISOString(),
      agentId: this.agentId,
      capabilities: cloneCapabilities(this.capabilities),
      limitations: this.limitations.map((lim) => ({ ...lim, workarounds: [...lim.workarounds] })),
      strengths: this.strengths.map((str) => ({ ...str, evidence: [...str.evidence] })),
      personalityTraits: { ...this.personality },
      behavioralPatterns: { ...this.behavioralPatterns },
      totalInteractions: this.totalInteractions,
      totalLearnings: this.totalLearnings,
      version: SelfModelSystem.VERSION,
    };
  }

  getIntrospectionSummary(): IntrospectionSummary {
    const capabilities: IntrospectionSummary["capabilities"] = {};
    for (const [domain, cap] of Object.entries(this.capabilities)) {
      capabilities[domain] = {
        level: CAPABILITY_LEVEL_NAME[cap.level],
        confidence: cap.confidence,
        trend: cap.trend,
      };
    }

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - sevenDaysMs;
    const recentUpdates = this.updateHistory.filter(
      (entry) => Date.parse(entry.timestamp) >= cutoff,
    ).length;

    const dominantBehaviors = Object.entries(this.behavioralPatterns)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3);

    return {
      agentId: this.agentId,
      totalInteractions: this.totalInteractions,
      totalLearnings: this.totalLearnings,
      capabilities,
      activeLimitations: this.getActiveLimitations().length,
      overcomeLimitations: this.limitations.filter((lim) => lim.isOvercome)
        .length,
      strengthsCount: this.strengths.length,
      topStrengths: this.getTopStrengths(3).map((str) => str.description),
      personality: { ...this.personality },
      dominantBehaviors,
      recentUpdates,
      selfDescription: this.generateSelfDescription(),
    };
  }

  save(): void {
    const snapshot = this.createSnapshot();
    mkdirSync(dirname(this.snapshotPath), { recursive: true });
    writeFileSync(this.snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");
  }

  load(): boolean {
    if (!existsSync(this.snapshotPath)) {
      return false;
    }
    let parsed: SelfModelSnapshot;
    try {
      const raw = readFileSync(this.snapshotPath, "utf8");
      parsed = JSON.parse(raw) as SelfModelSnapshot;
    } catch {
      return false;
    }
    this.restoreFromSnapshot(parsed);
    return true;
  }

  private restoreFromSnapshot(snapshot: SelfModelSnapshot): void {
    if (snapshot.capabilities) {
      for (const [domain, cap] of Object.entries(snapshot.capabilities)) {
        if (!(domain in this.capabilities)) {
          continue;
        }
        this.capabilities[domain] = {
          domain: cap.domain,
          level: cap.level,
          confidence: cap.confidence,
          evidenceCount: cap.evidenceCount,
          lastAssessed: cap.lastAssessed,
          recentSuccesses: cap.recentSuccesses,
          recentFailures: cap.recentFailures,
          trend: cap.trend,
          notes: [...(cap.notes ?? [])],
        };
      }
    }

    if (Array.isArray(snapshot.limitations)) {
      this.limitations.length = 0;
      for (const lim of snapshot.limitations) {
        this.limitations.push({
          ...lim,
          workarounds: [...(lim.workarounds ?? [])],
        });
      }
    }

    if (Array.isArray(snapshot.strengths)) {
      this.strengths.length = 0;
      for (const str of snapshot.strengths) {
        this.strengths.push({
          ...str,
          evidence: [...(str.evidence ?? [])],
        });
      }
    }

    if (snapshot.personalityTraits) {
      for (const [key, value] of Object.entries(snapshot.personalityTraits)) {
        if (typeof value === "number") {
          this.personality[key] = value;
        }
      }
    }

    if (snapshot.behavioralPatterns) {
      for (const [key, value] of Object.entries(snapshot.behavioralPatterns)) {
        if (typeof value === "number") {
          this.behavioralPatterns[key] = value;
        }
      }
    }

    if (typeof snapshot.totalInteractions === "number") {
      this.totalInteractions = snapshot.totalInteractions;
    }
    if (typeof snapshot.totalLearnings === "number") {
      this.totalLearnings = snapshot.totalLearnings;
    }
  }

  private requireCapability(
    domain: CapabilityDomain,
  ): CapabilityAssessment {
    let cap = this.capabilities[domain];
    if (!cap) {
      const now = new Date().toISOString();
      cap = {
        domain,
        level: DEFAULT_CAPABILITIES[domain] ?? CapabilityLevel.NOVICE,
        confidence: 0.5,
        evidenceCount: 0,
        lastAssessed: now,
        recentSuccesses: 0,
        recentFailures: 0,
        trend: "stable",
        notes: ["Initial baseline assessment"],
      };
      this.capabilities[domain] = cap;
    }
    return cap;
  }
}

function cloneCapabilities(
  source: Record<string, CapabilityAssessment>,
): Record<string, CapabilityAssessment> {
  const out: Record<string, CapabilityAssessment> = {};
  for (const [domain, cap] of Object.entries(source)) {
    out[domain] = { ...cap, notes: [...cap.notes] };
  }
  return out;
}
