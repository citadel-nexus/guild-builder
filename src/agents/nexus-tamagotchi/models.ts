import { createHash, randomUUID } from 'node:crypto';

export enum MemoryType {
  DIALOGUE = 'dialogue',
  REFLECTION = 'reflection',
  STRATEGY = 'strategy',
  PLAN = 'plan',
  ERROR = 'error',
  TASK = 'task',
  GROWTH = 'growth',
  GOVERNANCE = 'governance',
  DECISION = 'decision',
  KNOWLEDGE = 'knowledge',
}

export enum EmotionalState {
  HAPPY = 'happy',
  CONTENT = 'content',
  CURIOUS = 'curious',
  LEARNING = 'learning',
  TIRED = 'tired',
  FRUSTRATED = 'frustrated',
  GROWING = 'growing',
  GOVERNED = 'governed',
  CELEBRATED = 'celebrated',
}

export enum GameRank {
  INITIATE = 'INITIATE',
  APPRENTICE = 'APPRENTICE',
  JOURNEYMAN = 'JOURNEYMAN',
  EXPERT = 'EXPERT',
  MASTER = 'MASTER',
  LEGEND = 'LEGEND',
  ARCHITECT = 'ARCHITECT',
  SAGE = 'SAGE',
}

export enum CouncilPipelineVerdict {
  ALLOW = 'ALLOW',
  REVIEW = 'REVIEW',
  DENY = 'DENY',
}

export enum HealthMetric {
  COHERENCE = 'coherence',
  TRUST = 'trust',
  SOVEREIGNTY = 'sovereignty',
  COMPLEXITY = 'complexity',
}

export type MemoryObjectRecord = {
  id: string;
  agentId: string;
  inputText: string;
  outputText: string;
  memoryType: MemoryType;
  embedding: number[];
  trustScore: number;
  createdAt: string;
  fingerprint: string;
  governanceVerdict?: string;
  councilHash?: string;
};

export class MemoryObject {
  id: string;
  agentId: string;
  inputText: string;
  outputText: string;
  memoryType: MemoryType;
  embedding: number[];
  trustScore: number;
  createdAt: string;
  fingerprint: string;
  governanceVerdict?: string;
  councilHash?: string;

  constructor(initial: Partial<MemoryObjectRecord> = {}) {
    this.id = initial.id ?? randomUUID();
    this.agentId = initial.agentId ?? '';
    this.inputText = initial.inputText ?? '';
    this.outputText = initial.outputText ?? '';
    this.memoryType = initial.memoryType ?? MemoryType.DIALOGUE;
    this.embedding = initial.embedding ? [...initial.embedding] : [];
    this.trustScore = initial.trustScore ?? 0.5;
    this.createdAt = initial.createdAt ?? new Date().toISOString();
    this.fingerprint = initial.fingerprint ?? '';
    this.governanceVerdict = initial.governanceVerdict;
    this.councilHash = initial.councilHash;
  }

  computeFingerprint(): string {
    const content = `${this.inputText}:${this.outputText}`;
    return createHash('sha256').update(content).digest('hex');
  }

  toDict(): MemoryObjectRecord {
    return {
      id: this.id,
      agentId: this.agentId,
      inputText: this.inputText,
      outputText: this.outputText,
      memoryType: this.memoryType,
      embedding: [...this.embedding],
      trustScore: this.trustScore,
      createdAt: this.createdAt,
      fingerprint: this.fingerprint,
      governanceVerdict: this.governanceVerdict,
      councilHash: this.councilHash,
    };
  }
}

export type NexusAgentVitalsRecord = {
  emotionalState: EmotionalState;
  energyLevel: number;
  learningProgress: number;
  memoryCount: number;
  reflectionCount: number;
  growthStage: number;
  gameRank: GameRank;
  xpBalance: number;
  tpBalance: number;
  trustScore: number;
  capsGrade: string;
  lastReflection?: string;
  interactionCount: number;
};

export class NexusAgentVitals {
  emotionalState: EmotionalState;
  energyLevel: number;
  learningProgress: number;
  memoryCount: number;
  reflectionCount: number;
  growthStage: number;
  gameRank: GameRank;
  xpBalance: number;
  tpBalance: number;
  trustScore: number;
  capsGrade: string;
  lastReflection?: string;
  interactionCount: number;

  constructor(initial: Partial<NexusAgentVitalsRecord> = {}) {
    this.emotionalState = initial.emotionalState ?? EmotionalState.CURIOUS;
    this.energyLevel = initial.energyLevel ?? 0.8;
    this.learningProgress = initial.learningProgress ?? 0;
    this.memoryCount = initial.memoryCount ?? 0;
    this.reflectionCount = initial.reflectionCount ?? 0;
    this.growthStage = initial.growthStage ?? 1;
    this.gameRank = initial.gameRank ?? GameRank.INITIATE;
    this.xpBalance = initial.xpBalance ?? 0;
    this.tpBalance = initial.tpBalance ?? 0;
    this.trustScore = initial.trustScore ?? 0.5;
    this.capsGrade = initial.capsGrade ?? 'C';
    this.lastReflection = initial.lastReflection;
    this.interactionCount = initial.interactionCount ?? 0;
  }

  toDict(): NexusAgentVitalsRecord {
    return {
      emotionalState: this.emotionalState,
      energyLevel: this.energyLevel,
      learningProgress: this.learningProgress,
      memoryCount: this.memoryCount,
      reflectionCount: this.reflectionCount,
      growthStage: this.growthStage,
      gameRank: this.gameRank,
      xpBalance: this.xpBalance,
      tpBalance: this.tpBalance,
      trustScore: this.trustScore,
      capsGrade: this.capsGrade,
      lastReflection: this.lastReflection,
      interactionCount: this.interactionCount,
    };
  }
}

export type GovernanceDecisionRecord = {
  id: string;
  agentId: string;
  decisionType: string;
  description: string;
  context: Record<string, unknown>;
  verdict: CouncilPipelineVerdict;
  confidence: number;
  approvers: string[];
  timestamp: string;
  hashChain?: string;
};

export class GovernanceDecision {
  id: string;
  agentId: string;
  decisionType: string;
  description: string;
  context: Record<string, unknown>;
  verdict: CouncilPipelineVerdict;
  confidence: number;
  approvers: string[];
  timestamp: string;
  hashChain?: string;

  constructor(initial: Partial<GovernanceDecisionRecord> = {}) {
    this.id = initial.id ?? randomUUID();
    this.agentId = initial.agentId ?? '';
    this.decisionType = initial.decisionType ?? '';
    this.description = initial.description ?? '';
    this.context = initial.context ? { ...initial.context } : {};
    this.verdict = initial.verdict ?? CouncilPipelineVerdict.REVIEW;
    this.confidence = initial.confidence ?? 0.5;
    this.approvers = initial.approvers ? [...initial.approvers] : [];
    this.timestamp = initial.timestamp ?? new Date().toISOString();
    this.hashChain = initial.hashChain;
  }

  computeHash(previousHash?: string): string {
    const head = previousHash ?? '';
    const payload = `${head}${this.id}${this.decisionType}${this.verdict}`;
    return createHash('sha256').update(payload).digest('hex');
  }

  toDict(): GovernanceDecisionRecord {
    return {
      id: this.id,
      agentId: this.agentId,
      decisionType: this.decisionType,
      description: this.description,
      context: { ...this.context },
      verdict: this.verdict,
      confidence: this.confidence,
      approvers: [...this.approvers],
      timestamp: this.timestamp,
      hashChain: this.hashChain,
    };
  }
}