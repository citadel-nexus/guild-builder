import { connect, type NatsConnection } from 'nats';

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
import { MissionEngine } from './missions.js';
import { OutcomeXPEngine } from './outcome-xp.js';
import { QuestSystem } from './quests.js';
import { ReflexEngine } from './reflex-engine.js';
import { SkillTreeSystem } from './skill-tree-system.js';
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
  readonly insightEngine: InsightEngine;
  readonly skillTreeSystem: SkillTreeSystem;
  readonly engagementEngine = new ZayaraEngagementEngine();
  readonly srsValidator = new OperationalSRSValidator();
  private readonly state: AgentState;

  constructor(
    readonly config: NexusTamagotchiConfig,
    private readonly natsConnection: NatsConnection,
    env: NodeJS.ProcessEnv = process.env,
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
    this.insightEngine = new InsightEngine(this.brotherhood);
    this.skillTreeSystem = new SkillTreeSystem(this.brotherhood);
    this.state = initialState(config.agentId);
  }

  getState(): AgentState {
    return structuredClone(this.state);
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
export * from './authority.js';
export * from './brotherhood.js';
export * from './council.js';
export * from './diagnostics.js';
export * from './engagement.js';
export * from './function-rewards.js';
export * from './gamification.js';
export * from './integration-router.js';
export * from './integrations-manager.js';
export * from './insight.js';
export * from './leaderboard.js';
export * from './memory.js';
export * from './missions.js';
export * from './models.js';
export * from './outcome-xp.js';
export * from './professor-network.js';
export * from './progression.js';
export * from './quests.js';
export * from './reflex-engine.js';
export * from './secure-key-vault.js';
export * from './skill-tree-system.js';
export * from './srs.js';
export * from './types.js';
export * from './web-enrichment.js';