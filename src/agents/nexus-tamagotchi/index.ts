import { connect, type NatsConnection } from 'nats';

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
import {
  MCPProgressionSheet,
  PROGRESSION_SHEET,
} from './progression.js';
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
  }

  getState(): AgentState {
    return structuredClone(this.state);
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
export * from './auto-installation.js';
export * from './authority.js';
export * from './badge-system.js';
export * from './brotherhood.js';
export * from './cognitive-systems.js';
export * from './council.js';
export * from './diagnostics.js';
export * from './engagement.js';
export * from './function-rewards.js';
export * from './gamification.js';
export * from './integration-router.js';
export * from './integrations-manager.js';
export * from './insight.js';
export * from './leaderboard.js';
export * from './lingo.js';
export * from './memory.js';
export * from './missions.js';
export * from './models.js';
export * from './multi-channel-broadcast.js';
export * from './outcome-xp.js';
export * from './professor-network.js';
export * from './progression.js';
export * from './quests.js';
export * from './reflex-engine.js';
export * from './secure-key-vault.js';
export * from './skill-tracker.js';
export * from './skill-tree-system.js';
export * from './srs.js';
export * from './types.js';
export * from './web-enrichment.js';