import { connect, type NatsConnection } from 'nats';

import { GuardianAuditTrail } from './audit.js';
import { ConstitutionalCouncil } from './council.js';
import { BADGE_REGISTRY } from './data/badges.js';
import { PROFESSOR_REGISTRY } from './data/professors.js';
import { REFLEX_PATTERNS } from './data/reflexes.js';
import { SKILL_REGISTRY, SKILL_TREES } from './data/skills.js';
import {
  CITADEL_ROUTER,
  CitadelIntegrationRouter,
} from './integration-router.js';
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
  readonly srsValidator = new OperationalSRSValidator();
  private readonly state: AgentState;

  constructor(
    readonly config: NexusTamagotchiConfig,
    private readonly natsConnection: NatsConnection,
    env: NodeJS.ProcessEnv = process.env,
  ) {
    this.integrationRouter = new CitadelIntegrationRouter(env);
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
export * from './council.js';
export * from './diagnostics.js';
export * from './gamification.js';
export * from './integration-router.js';
export * from './integrations-manager.js';
export * from './memory.js';
export * from './models.js';
export * from './professor-network.js';
export * from './progression.js';
export * from './secure-key-vault.js';
export * from './srs.js';
export * from './types.js';
export * from './web-enrichment.js';