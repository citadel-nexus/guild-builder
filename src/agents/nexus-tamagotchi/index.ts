import { connect, type NatsConnection } from 'nats';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { BadgeSystem } from './badge-system.js';
import {
  CognitiveSystemsRegistry,
  buildPreflightAssessment,
  renderCognitiveSystemsStatus,
  renderPreflightAssessment,
  type CognitiveSystemKey,
  type CognitiveSystemStatus,
  type PreflightAssessment,
  type PreflightAssessmentInput,
} from './cognitive-systems.js';
import { GuardianAuditTrail } from './audit.js';
import { AuthorityGate } from './authority.js';
import { BrotherhoodSystem } from './brotherhood.js';
import { ConstitutionalCouncil } from './council.js';
import { BADGE_REGISTRY } from './data/badges.js';
import { PROFESSOR_REGISTRY } from './data/professors.js';
import { REFLEX_PATTERNS } from './data/reflexes.js';
import { SKILL_REGISTRY, SKILL_TREES } from './data/skills.js';
import {
  CITADEL_ROUTER,
  CitadelIntegrationRouter,
} from './integration-router.js';
import { IntegrationsManager } from './integrations-manager.js';
import { InsightEngine } from './insight.js';
import { LeaderboardSystem } from './leaderboard.js';
import {
  LingoAdapter,
  renderLingoProfile,
  type LingoAnalysis,
  type LingoProfile,
} from './lingo.js';
import { MissionEngine } from './missions.js';
import { MultiChannelBroadcaster } from './multi-channel-broadcast.js';
import { OutcomeXPEngine } from './outcome-xp.js';
import { QuestSystem } from './quests.js';
import { ReflexEngine } from './reflex-engine.js';
import { SkillTreeSystem } from './skill-tree-system.js';
import { SkillTracker } from './skill-tracker.js';
import { FunctionRewardsMap } from './function-rewards.js';
import { ZayaraEngagementEngine } from './engagement.js';
import { SimpleDiagnostics } from './diagnostics.js';
import { GameificationEngine } from './gamification.js';
import {
  MCPProgressionSheet,
  PROGRESSION_SHEET,
} from './progression.js';
import { EmotionalState, GameRank, NexusAgentVitals } from './models.js';
import {
  OperationalSRSValidator,
  SRS_REGISTRY,
  getSrsSummary,
  validateSrsCoverage,
} from './srs.js';
import type { AgentState, NexusTamagotchiConfig } from './types.js';

function initialState(agentId: string): AgentState {
  const now = new Date().toISOString();
  return {
    version: '1.0.0',
    agentId,
    vitals: {
      energy: 100,
      mood: 100,
      focus: 100,
      health: 100,
      hunger: 0,
      curiosity: 100,
    },
    xp: 0,
    tp: 0,
    rank: 'initiate',
    authority: 'OBSERVE',
    caps: {
      cognitive: 0,
      autonomy: 0,
      proficiency: 0,
      social: 0,
      overall: 0,
    },
    badges: [],
    skills: [],
    activeMissions: [],
    activeQuests: [],
    streakDays: 0,
    interactionCount: 0,
    memoryCount: 0,
    lastInteraction: now,
    createdAt: now,
  };
}

function mapGameRankToStateRank(rank: GameRank): AgentState['rank'] {
  if (rank === GameRank.APPRENTICE) {
    return 'apprentice';
  }
  if (rank === GameRank.JOURNEYMAN) {
    return 'journeyman';
  }
  if (rank === GameRank.EXPERT) {
    return 'artisan';
  }
  if (rank === GameRank.MASTER) {
    return 'master';
  }
  if (rank === GameRank.LEGEND) {
    return 'grandmaster';
  }
  if (rank === GameRank.ARCHITECT) {
    return 'elder';
  }
  if (rank === GameRank.SAGE) {
    return 'legend';
  }
  return 'initiate';
}

type PersistedMemoryRecord = {
  id: string;
  inputText: string;
  outputText: string;
  memoryType: string;
  trustScore: number;
  createdAt: string;
};

type PersistedRuntimeState = {
  agentId: string;
  agentName: string;
  state: AgentState;
  questionCount: number;
  brotherhood: {
    totalXp: number;
    totalTp: number;
    rank: GameRank;
    streakDays: number;
  };
  memories: PersistedMemoryRecord[];
  lastSaveTimestamp: string;
};

function parseRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function parseNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function parseString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function parseGameRank(value: unknown): GameRank {
  if (typeof value !== 'string') {
    return GameRank.INITIATE;
  }
  const all = Object.values(GameRank);
  return all.includes(value as GameRank) ? (value as GameRank) : GameRank.INITIATE;
}

type RuntimeNatsConnection = Pick<NatsConnection, 'drain'>;

export class NexusTamagotchiRuntime {
  readonly progression = new MCPProgressionSheet();
  readonly progressionSheet = PROGRESSION_SHEET;
  readonly auditTrail = new GuardianAuditTrail();
  readonly council = new ConstitutionalCouncil(this.auditTrail);
  readonly integrationRouter: CitadelIntegrationRouter;
  readonly integrationsManager: IntegrationsManager;
  readonly brotherhood: BrotherhoodSystem;
  readonly authorityGate: AuthorityGate;
  readonly reflexEngine: ReflexEngine;
  readonly functionRewards = new FunctionRewardsMap();
  readonly missionEngine: MissionEngine;
  readonly questSystem: QuestSystem;
  readonly outcomeXpEngine: OutcomeXPEngine;
  readonly leaderboardSystem: LeaderboardSystem;
  readonly badgeSystem: BadgeSystem;
  readonly multiChannelBroadcaster: MultiChannelBroadcaster;
  readonly insightEngine: InsightEngine;
  readonly skillTreeSystem: SkillTreeSystem;
  readonly skillTracker: SkillTracker;
  readonly diagnostics = new SimpleDiagnostics();
  readonly gamification = new GameificationEngine();
  readonly lingoAdapter = new LingoAdapter();
  readonly cognitiveSystems = new CognitiveSystemsRegistry();
  readonly engagementEngine = new ZayaraEngagementEngine();
  readonly srsValidator = new OperationalSRSValidator();
  readonly _cognitive_cortex = {
    attention: (): 'attention' => 'attention',
    planning: (): 'planning' => 'planning',
    decision: (): 'decision' => 'decision',
  };
  readonly _cognitive_mind = {
    route_to_domain: (domain: string): string => domain,
  };
  private readonly state: AgentState;
  private readonly persistenceDir: string;
  private readonly stateFilePath: string;
  private readonly memoriesFilePath: string;
  private memories: PersistedMemoryRecord[] = [];
  private questionCount = 0;
  private preflightAssessment: PreflightAssessment;

  constructor(
    readonly config: NexusTamagotchiConfig,
    private readonly natsConnection: RuntimeNatsConnection,
    env: NodeJS.ProcessEnv = process.env,
    preflightInput: PreflightAssessmentInput = {},
  ) {
    this.integrationRouter = new CitadelIntegrationRouter(env);
    this.integrationsManager = new IntegrationsManager(
      env,
      this.integrationRouter,
    );
    this.brotherhood = new BrotherhoodSystem(config.agentId);
    this.authorityGate = new AuthorityGate(this.brotherhood);
    this.reflexEngine = new ReflexEngine(config.agentId);
    this.missionEngine = new MissionEngine(this.brotherhood);
    this.questSystem = new QuestSystem(this.brotherhood);
    this.outcomeXpEngine = new OutcomeXPEngine(this.integrationsManager);
    this.leaderboardSystem = new LeaderboardSystem(this.integrationsManager);
    this.badgeSystem = new BadgeSystem(this.brotherhood);
    this.multiChannelBroadcaster = new MultiChannelBroadcaster(
      this.integrationsManager,
      this.integrationRouter,
    );
    this.insightEngine = new InsightEngine(this.brotherhood, this.integrationsManager);
    this.skillTreeSystem = new SkillTreeSystem(this.brotherhood);
    this.skillTracker = new SkillTracker(config.agentId);
    this.state = initialState(config.agentId);
    this.persistenceDir =
      config.persistencePath ?? join('.nexus_cache', this.config.agentId);
    this.stateFilePath = join(this.persistenceDir, 'agent_state.json');
    this.memoriesFilePath = join(this.persistenceDir, 'memories.json');
    this.preflightAssessment = buildPreflightAssessment(preflightInput);

    this.cognitiveSystems.setSystemStatus('nexus_cortex', {
      available: true,
      initialized: true,
    });
    this.cognitiveSystems.setSystemStatus('nlp_mca', {
      available: (env.NEXUS_NLP_MCA ?? '').toLowerCase() === 'on',
      initialized: false,
      signalCount: 0,
    });
    this.cognitiveSystems.setSystemStatus('nexus_mind', {
      available: (env.NEXUS_MIND ?? '').toLowerCase() === 'on',
      initialized: false,
      learningMemorySize: 0,
      persistentMemorySize: 0,
    });
    this.cognitiveSystems.setSystemStatus('nexus_sense', {
      available: (env.NEXUS_SENSE ?? '').toLowerCase() === 'on',
      initialized: false,
    });
    this.cognitiveSystems.setSystemStatus('nexus_memory', {
      available: (env.NEXUS_MEMORY ?? '').toLowerCase() === 'on',
      initialized: false,
    });
    this.cognitiveSystems.setSystemStatus('nexus_council', {
      available: (env.NEXUS_COUNCIL ?? '').toLowerCase() === 'on',
      initialized: false,
    });

    this.loadState();
    this.syncRankFromBrotherhood();
  }

  getState(): AgentState {
    return structuredClone(this.state);
  }

  status(): Record<string, unknown> {
    this.syncRankFromBrotherhood();
    const vitals = this.buildNexusVitals();
    return {
      agent_id: this.config.agentId,
      agent_name: this.config.agentId,
      interaction_count: this.state.interactionCount,
      vitals: vitals.toDict(),
      recommendations: this.diagnostics.getRecommendations(vitals),
      memory_count: this.memories.length,
      timestamp: new Date().toISOString(),
    };
  }

  getComprehensiveStatus(): Record<string, unknown> {
    this.syncRankFromBrotherhood();
    const vitals = this.buildNexusVitals();
    const auditEntries = this.auditTrail.getEntries();
    return {
      agent: {
        id: this.config.agentId,
        name: this.config.agentId,
      },
      vitals: vitals.toDict(),
      council: {
        operational: true,
        decisions: auditEntries.length,
        confidence: 0.85,
      },
      gamification: {
        operational: true,
        xp_balance: this.brotherhood.totalXp,
        rank: this.brotherhood.rank,
        level: this.gamification.getLevel(this.brotherhood.totalXp),
        streak_days: this.brotherhood.streakDays,
      },
      professors: {
        count: PROFESSOR_REGISTRY.length,
        knowledge_items: this.insightEngine.insights.length,
      },
      knowledge: {
        vectors: this.memories.length,
        domains: 28,
        growth_rate: 0.25,
      },
      audit: {
        entries: auditEntries.length,
        valid: this.auditTrail.verifyChain(),
        retention: 2555,
        last_entry:
          auditEntries.length > 0
            ? auditEntries[auditEntries.length - 1].timestamp
            : null,
      },
    };
  }

  renderSimpleVitals(): string {
    this.syncRankFromBrotherhood();
    const integrationCounts = this.getIntegrationCounts();
    const energy = `${Math.round(this.state.vitals.energy)}%`;
    const xp = this.brotherhood.totalXp;
    const tp = this.brotherhood.totalTp;
    return [
      `NEXUS VITALS (${this.config.agentId})`,
      `Energy: ${energy}`,
      `Mood: ${this.state.vitals.mood}`,
      `Focus: ${this.state.vitals.focus}`,
      `Health: ${this.state.vitals.health}`,
      `Curiosity: ${this.state.vitals.curiosity}`,
      `XP: ${xp} | TP: ${tp} | Rank: ${this.brotherhood.rank}`,
      `Integrations: ${integrationCounts.active}/${integrationCounts.total}`,
      `Interactions: ${this.state.interactionCount}`,
    ].join('\n');
  }

  saveState(): void {
    this.syncRankFromBrotherhood();
    const payload: PersistedRuntimeState = {
      agentId: this.config.agentId,
      agentName: this.config.agentId,
      state: this.getState(),
      questionCount: this.questionCount,
      brotherhood: {
        totalXp: this.brotherhood.totalXp,
        totalTp: this.brotherhood.totalTp,
        rank: this.brotherhood.rank,
        streakDays: this.brotherhood.streakDays,
      },
      memories: this.memories.map((memory) => ({ ...memory })),
      lastSaveTimestamp: new Date().toISOString(),
    };
    mkdirSync(this.persistenceDir, { recursive: true });
    writeFileSync(this.stateFilePath, JSON.stringify(payload, null, 2), 'utf8');
    writeFileSync(
      this.memoriesFilePath,
      JSON.stringify(payload.memories, null, 2),
      'utf8',
    );
  }

  loadState(): void {
    if (existsSync(this.stateFilePath)) {
      try {
        const parsed = parseRecord(JSON.parse(readFileSync(this.stateFilePath, 'utf8')));
        const parsedState = parseRecord(parsed.state);
        this.state.vitals.energy = parseNumber(
          parseRecord(parsedState.vitals).energy,
          this.state.vitals.energy,
        );
        this.state.vitals.mood = parseNumber(
          parseRecord(parsedState.vitals).mood,
          this.state.vitals.mood,
        );
        this.state.vitals.focus = parseNumber(
          parseRecord(parsedState.vitals).focus,
          this.state.vitals.focus,
        );
        this.state.vitals.health = parseNumber(
          parseRecord(parsedState.vitals).health,
          this.state.vitals.health,
        );
        this.state.vitals.hunger = parseNumber(
          parseRecord(parsedState.vitals).hunger,
          this.state.vitals.hunger,
        );
        this.state.vitals.curiosity = parseNumber(
          parseRecord(parsedState.vitals).curiosity,
          this.state.vitals.curiosity,
        );
        this.state.interactionCount = parseNumber(
          parsedState.interactionCount,
          this.state.interactionCount,
        );
        this.state.memoryCount = parseNumber(
          parsedState.memoryCount,
          this.state.memoryCount,
        );
        this.state.lastInteraction = parseString(
          parsedState.lastInteraction,
          this.state.lastInteraction,
        );
        this.questionCount = parseNumber(parsed.questionCount, this.questionCount);

        const persistedBrotherhood = parseRecord(parsed.brotherhood);
        this.brotherhood.totalXp = parseNumber(
          persistedBrotherhood.totalXp,
          this.brotherhood.totalXp,
        );
        this.brotherhood.totalTp = parseNumber(
          persistedBrotherhood.totalTp,
          this.brotherhood.totalTp,
        );
        this.brotherhood.rank = parseGameRank(persistedBrotherhood.rank);
        this.brotherhood.streakDays = parseNumber(
          persistedBrotherhood.streakDays,
          this.brotherhood.streakDays,
        );
      } catch {
        return;
      }
    }

    if (existsSync(this.memoriesFilePath)) {
      try {
        const parsed = JSON.parse(readFileSync(this.memoriesFilePath, 'utf8'));
        if (Array.isArray(parsed)) {
          this.memories = parsed
            .map((value) => parseRecord(value))
            .map((record) => ({
              id: parseString(record.id, ''),
              inputText: parseString(record.inputText, ''),
              outputText: parseString(record.outputText, ''),
              memoryType: parseString(record.memoryType, 'dialogue'),
              trustScore: parseNumber(record.trustScore, 0.5),
              createdAt: parseString(record.createdAt, ''),
            }))
            .filter((entry) => entry.id.length > 0);
          this.state.memoryCount = this.memories.length;
        }
      } catch {
        return;
      }
    }
  }

  _saveState(): void {
    this.saveState();
  }

  _loadState(): void {
    this.loadState();
  }

  _syncRankFromBrotherhood(): void {
    this.syncRankFromBrotherhood();
  }

  recordLingoInteraction(
    input: string,
    userId: string = 'default',
  ): LingoAnalysis {
    return this.lingoAdapter.analyzeAndEvolve(input, userId);
  }

  getLingoProfile(userId: string = 'default'): LingoProfile | undefined {
    return this.lingoAdapter.getProfile(userId);
  }

  displayLingoProfile(userId: string = 'default'): string {
    return renderLingoProfile(userId, this.getLingoProfile(userId));
  }

  setCognitiveSystemStatus(
    system: CognitiveSystemKey,
    status: Partial<CognitiveSystemStatus>,
  ): void {
    this.cognitiveSystems.setSystemStatus(system, status);
  }

  getCognitiveSystemsStatus() {
    return this.cognitiveSystems.getStatus();
  }

  displayCognitiveStatus(): string {
    return renderCognitiveSystemsStatus(this.getCognitiveSystemsStatus());
  }

  getPreflightAssessment(): PreflightAssessment {
    return {
      ...this.preflightAssessment,
      stageResults: structuredClone(this.preflightAssessment.stageResults),
      recommendations: [...this.preflightAssessment.recommendations],
    };
  }

  setPreflightAssessment(
    update: PreflightAssessmentInput,
  ): PreflightAssessment {
    this.preflightAssessment = buildPreflightAssessment(update);
    return this.getPreflightAssessment();
  }

  displayPreflightStatus(): string {
    return renderPreflightAssessment(this.preflightAssessment);
  }

  runCognitiveOperationsTest(): {
    ok: boolean;
    failed: string[];
    systems: ReturnType<NexusTamagotchiRuntime['getCognitiveSystemsStatus']>;
  } {
    const failed: string[] = [];
    const systems = this.getCognitiveSystemsStatus();
    for (const [key, status] of Object.entries(systems)) {
      if (status.available && !status.initialized) {
        failed.push(key);
      }
    }

    const hasCortexSurface =
      typeof this._cognitive_cortex.attention === 'function' &&
      typeof this._cognitive_cortex.planning === 'function' &&
      typeof this._cognitive_cortex.decision === 'function';
    if (!hasCortexSurface) {
      failed.push('nexus_cortex_surface');
    }

    const hasMindSurface =
      typeof this._cognitive_mind.route_to_domain === 'function';
    if (!hasMindSurface) {
      failed.push('nexus_mind_surface');
    }

    return {
      ok: failed.length === 0,
      failed,
      systems,
    };
  }

  async stop(): Promise<void> {
    await this.natsConnection.drain();
  }

  private syncRankFromBrotherhood(): void {
    this.state.xp = this.brotherhood.totalXp;
    this.state.tp = this.brotherhood.totalTp;
    this.state.rank = mapGameRankToStateRank(this.brotherhood.rank);
  }

  private getIntegrationCounts(): { active: number; total: number } {
    const status = this.integrationsManager.getStatus();
    const total = Object.keys(status).length;
    const active = Object.values(status).filter((enabled) => enabled).length;
    return {
      active,
      total,
    };
  }

  private buildNexusVitals(): NexusAgentVitals {
    const inferredGrowth = Math.max(
      1,
      Math.min(10, Math.floor(this.state.interactionCount / 20) + 1),
    );
    return new NexusAgentVitals({
      emotionalState:
        this.state.vitals.energy < 30 ? EmotionalState.TIRED : EmotionalState.CURIOUS,
      energyLevel: this.state.vitals.energy / 100,
      learningProgress: Math.min(1, this.state.memoryCount / 100),
      memoryCount: this.memories.length,
      reflectionCount: Math.floor(this.state.interactionCount / 5),
      growthStage: inferredGrowth,
      gameRank: this.brotherhood.rank,
      xpBalance: this.brotherhood.totalXp,
      tpBalance: this.brotherhood.totalTp,
      trustScore: 0.5,
      capsGrade: 'C',
      interactionCount: this.state.interactionCount,
    });
  }
}

export type NexusAutoStartResult = {
  started: boolean;
  reason?: string;
  runtime?: NexusTamagotchiRuntime;
  stop?: () => Promise<void>;
};

export async function maybeStartNexusTamagotchi(
  env: NodeJS.ProcessEnv = process.env,
): Promise<NexusAutoStartResult> {
  if ((env.NEXUS_TAMAGOTCHI ?? '').toLowerCase() !== 'on') {
    return { started: false, reason: 'NEXUS_TAMAGOTCHI != on' };
  }

  const natsUrl = env.NATS_URL;
  if (!natsUrl) {
    return { started: false, reason: 'NATS_URL is required' };
  }

  const config: NexusTamagotchiConfig = {
    agentId: env.NEXUS_AGENT_ID ?? 'nexus-001',
    natsUrl,
    natsToken: env.NATS_TOKEN,
    subjectPrefix: env.NEXUS_NATS_PREFIX ?? 'citadel.builder.nexus',
    debug: false,
  };

  const nc = await connect({
    servers: config.natsUrl,
    token: config.natsToken,
  });

  const runtime = new NexusTamagotchiRuntime(config, nc);
  return {
    started: true,
    runtime,
    stop: async () => runtime.stop(),
  };
}

export {
  BADGE_REGISTRY,
  CITADEL_ROUTER,
  PROFESSOR_REGISTRY,
  REFLEX_PATTERNS,
  SRS_REGISTRY,
  SKILL_REGISTRY,
  SKILL_TREES,
  getSrsSummary,
  validateSrsCoverage,
};

export * from './audit.js';
export * from './agent-factory.js';
export * from './analytics-automation.js';
export * from './advanced-quest-engine.js';
export * from './api-integration-layer.js';
export * from './auto-installation.js';
export * from './authority.js';
export * from './badge-system.js';
export * from './brotherhood.js';
export * from './backend-auth.js';
export * from './cognitive-integration.js';
export * from './cognitive-systems.js';
export * from './configuration-manager.js';
export * from './conversation-flow.js';
export * from './council.js';
export * from './context-rehydration.js';
export * from './diagnostics.js';
export * from './domain-learning.js';
export * from './distribution.js';
export * from './engagement.js';
export * from './event-logging.js';
export * from './extended-professor-network.js';
export * from './function-rewards.js';
export * from './gamification.js';
export * from './integration-router.js';
export * from './integrations-manager.js';
export * from './insight.js';
export * from './leaderboard.js';
export * from './lingo.js';
export * from './memory.js';
export * from './memory-graph.js';
export * from './missions.js';
export * from './models.js';
export * from './multi-channel-broadcast.js';
export * from './notification-system.js';
export * from './outcome-xp.js';
export * from './professor-network.js';
export * from './progression.js';
export * from './quests.js';
export * from './reflex-engine.js';
export * from './secure-key-vault.js';
export * from './self-awareness.js';
export * from './comprehensive-achievement-system.js';
export * from './comprehensive-leaderboard-system.js';
export * from './comprehensive-skill-tree.js';
export * from './skill-tracker.js';
export * from './skill-tree-system.js';
export * from './short-term-memory.js';
export * from './srs.js';
export * from './long-term-memory.js';
export * from './extended-knowledge-graph.js';
export * from './types.js';
export * from './ui-system.js';
export * from './web-enrichment.js';
export * from './workshop.js';