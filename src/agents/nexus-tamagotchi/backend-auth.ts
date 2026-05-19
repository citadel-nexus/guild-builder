import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { BrotherhoodSystem } from './brotherhood.js';
import { GameRank } from './models.js';

export type AuthResult = {
  success: boolean;
  sessionToken?: string;
  userId?: string;
  userTier: string;
  features: Record<string, boolean>;
  xpBalance: number;
  tpBalance: number;
  rank: string;
  expiresAt?: string;
  error?: string;
  rateLimitRemaining: number;
};

export type FeatureCheckResult = {
  allowed: boolean;
  featureKey: string;
  reason?: string;
  requiredTier?: string;
  currentTier: string;
  upgradeUrl?: string;
  cached: boolean;
  cacheExpiresAt?: string;
};

export type SyncResult = {
  success: boolean;
  requestedAmount: number;
  validatedAmount: number;
  newTotal: number;
  rankChanged: boolean;
  newRank?: string;
  badgesUnlocked: string[];
  validationFlags: string[];
  error?: string;
};

export type HeartbeatResult = {
  sessionValid: boolean;
  newExpiresAt?: string;
  featureUpdates: Record<string, boolean>;
  tierChanged: boolean;
  newTier?: string;
  availableUpgrades: Array<Record<string, unknown>>;
  serverMessages: string[];
  maintenanceMode: boolean;
};

export type UserProfile = {
  userId: string;
  username: string;
  email?: string;
  tier: string;
  subscriptionStatus: string;
  subscriptionExpiresAt?: string;
  xpTotal: number;
  tpTotal: number;
  rank: string;
  rankProgress: number;
  badges: string[];
  badgeCount: number;
  streakCurrent: number;
  streakBest: number;
  interactionsTotal: number;
  missionsCompleted: number;
  skillsUnlocked: string[];
  guild?: string;
  createdAt?: string;
  lastActiveAt?: string;
};

export type FeatureCacheEntry = {
  featureKey: string;
  allowed: boolean;
  currentTier: string;
  requiredTier?: string;
  expiresAt: string;
  checkCount: number;
};

export type OfflineXPEntry = {
  amount: number;
  reason: string;
  context: Record<string, unknown>;
  timestamp: string;
  interactionId?: string;
  missionId?: string;
};

export type OfflineTPEntry = {
  amount: number;
  reason: string;
  context: Record<string, unknown>;
  timestamp: string;
  interactionId?: string;
};

export enum AgentFeatureTier {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  NEXUS_DEV = 'nexus_dev',
  BUSINESS = 'business',
  ENTERPRISE = 'enterprise',
}

const TIER_LEVELS: Record<AgentFeatureTier, number> = {
  [AgentFeatureTier.FREE]: 0,
  [AgentFeatureTier.STARTER]: 1,
  [AgentFeatureTier.PRO]: 2,
  [AgentFeatureTier.NEXUS_DEV]: 3,
  [AgentFeatureTier.BUSINESS]: 4,
  [AgentFeatureTier.ENTERPRISE]: 5,
};

export function parseFeatureTier(value: string): AgentFeatureTier {
  const normalized = value.toLowerCase();
  const all = Object.values(AgentFeatureTier);
  return all.includes(normalized as AgentFeatureTier)
    ? (normalized as AgentFeatureTier)
    : AgentFeatureTier.FREE;
}

export function tierAtLeast(
  current: AgentFeatureTier,
  required: AgentFeatureTier,
): boolean {
  return TIER_LEVELS[current] >= TIER_LEVELS[required];
}

export const AGENT_FEATURE_TIERS: Record<string, AgentFeatureTier> = {
  basic_conversation: AgentFeatureTier.FREE,
  memory_10_items: AgentFeatureTier.FREE,
  reflex_responses: AgentFeatureTier.FREE,
  basic_vitals: AgentFeatureTier.FREE,
  local_state_persistence: AgentFeatureTier.FREE,
  interaction_xp_basic: AgentFeatureTier.FREE,
  memory_100_items: AgentFeatureTier.STARTER,
  badge_system: AgentFeatureTier.STARTER,
  daily_quests: AgentFeatureTier.STARTER,
  streak_tracking: AgentFeatureTier.STARTER,
  basic_leaderboard: AgentFeatureTier.STARTER,
  email_notifications: AgentFeatureTier.STARTER,
  xp_multiplier_1_5x: AgentFeatureTier.STARTER,
  custom_agent_name: AgentFeatureTier.STARTER,
  professor_network: AgentFeatureTier.PRO,
  mission_system: AgentFeatureTier.PRO,
  skill_trees: AgentFeatureTier.PRO,
  discord_broadcast: AgentFeatureTier.PRO,
  slack_broadcast: AgentFeatureTier.PRO,
  memory_unlimited: AgentFeatureTier.PRO,
  vector_memory_search: AgentFeatureTier.PRO,
  weekly_challenges: AgentFeatureTier.PRO,
  insight_engine: AgentFeatureTier.PRO,
  xp_multiplier_2x: AgentFeatureTier.PRO,
  rank_accelerator: AgentFeatureTier.PRO,
  guild_membership: AgentFeatureTier.PRO,
  council_governance: AgentFeatureTier.NEXUS_DEV,
  outcome_weighted_xp: AgentFeatureTier.NEXUS_DEV,
  multi_channel_broadcast: AgentFeatureTier.NEXUS_DEV,
  custom_reflexes: AgentFeatureTier.NEXUS_DEV,
  api_access: AgentFeatureTier.NEXUS_DEV,
  linear_integration: AgentFeatureTier.NEXUS_DEV,
  gitlab_integration: AgentFeatureTier.NEXUS_DEV,
  notion_sync: AgentFeatureTier.NEXUS_DEV,
  advanced_analytics: AgentFeatureTier.NEXUS_DEV,
  xp_multiplier_3x: AgentFeatureTier.NEXUS_DEV,
  priority_support: AgentFeatureTier.NEXUS_DEV,
  beta_features: AgentFeatureTier.NEXUS_DEV,
  team_management: AgentFeatureTier.BUSINESS,
  org_leaderboard: AgentFeatureTier.BUSINESS,
  role_management: AgentFeatureTier.BUSINESS,
  audit_logs: AgentFeatureTier.BUSINESS,
  sso_integration: AgentFeatureTier.BUSINESS,
  compliance_reports: AgentFeatureTier.BUSINESS,
  bulk_operations: AgentFeatureTier.BUSINESS,
  custom_branding: AgentFeatureTier.BUSINESS,
  dedicated_support: AgentFeatureTier.BUSINESS,
  on_prem_deployment: AgentFeatureTier.ENTERPRISE,
  white_label: AgentFeatureTier.ENTERPRISE,
  custom_professors: AgentFeatureTier.ENTERPRISE,
  private_cloud: AgentFeatureTier.ENTERPRISE,
  unlimited_api_calls: AgentFeatureTier.ENTERPRISE,
  custom_integrations: AgentFeatureTier.ENTERPRISE,
  sla_guarantee: AgentFeatureTier.ENTERPRISE,
  dedicated_account_manager: AgentFeatureTier.ENTERPRISE,
  training_sessions: AgentFeatureTier.ENTERPRISE,
  source_code_access: AgentFeatureTier.ENTERPRISE,
};

export const FEATURE_DESCRIPTIONS: Record<string, string> = {
  professor_network:
    'Access domain-expert routing for specialized knowledge operations.',
  mission_system: 'Enable mission lifecycle with outcome rewards.',
  skill_trees: 'Unlock tiered skill progression and spending paths.',
  discord_broadcast: 'Broadcast rank and achievement events to Discord.',
  slack_broadcast: 'Broadcast status and milestone events to Slack.',
  memory_unlimited: 'Increase long-term memory capacity limits.',
  vector_memory_search: 'Enable semantic vector retrieval over memory records.',
  council_governance: 'Enable constitutional governance decision routing.',
  outcome_weighted_xp: 'Apply impact-weighted XP normalization.',
  multi_channel_broadcast: 'Coordinate fan-out across notification channels.',
  custom_reflexes: 'Define custom deterministic response reflexes.',
  api_access: 'Allow API-driven external orchestration.',
  linear_integration: 'Enable Linear synchronization for mission tracking.',
  gitlab_integration: 'Enable GitLab context ingestion and enrichment.',
  notion_sync: 'Enable Notion publishing for insight records.',
  on_prem_deployment: 'Enable managed on-prem deployment workflows.',
  white_label: 'Enable organization branding overrides.',
  custom_professors: 'Enable custom professor profiles and catalogs.',
};

type PersistedOfflineBuffer = {
  xpBuffer: OfflineXPEntry[];
  tpBuffer: OfflineTPEntry[];
  totalBufferedXp: number;
  totalBufferedTp: number;
};

function parseNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function parseString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function parseRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function cloneXpEntry(entry: OfflineXPEntry): OfflineXPEntry {
  return {
    amount: entry.amount,
    reason: entry.reason,
    context: { ...entry.context },
    timestamp: entry.timestamp,
    interactionId: entry.interactionId,
    missionId: entry.missionId,
  };
}

function cloneTpEntry(entry: OfflineTPEntry): OfflineTPEntry {
  return {
    amount: entry.amount,
    reason: entry.reason,
    context: { ...entry.context },
    timestamp: entry.timestamp,
    interactionId: entry.interactionId,
  };
}

function parseXpEntry(value: unknown): OfflineXPEntry | undefined {
  const record = parseRecord(value);
  const amount = parseNumber(record.amount, Number.NaN);
  const reason = parseString(record.reason, '');
  const timestamp = parseString(record.timestamp, '');
  if (!Number.isFinite(amount) || reason.length === 0 || timestamp.length === 0) {
    return undefined;
  }
  return {
    amount,
    reason,
    context: parseRecord(record.context),
    timestamp,
    interactionId:
      typeof record.interactionId === 'string' ? record.interactionId : undefined,
    missionId: typeof record.missionId === 'string' ? record.missionId : undefined,
  };
}

function parseTpEntry(value: unknown): OfflineTPEntry | undefined {
  const record = parseRecord(value);
  const amount = parseNumber(record.amount, Number.NaN);
  const reason = parseString(record.reason, '');
  const timestamp = parseString(record.timestamp, '');
  if (!Number.isFinite(amount) || reason.length === 0 || timestamp.length === 0) {
    return undefined;
  }
  return {
    amount,
    reason,
    context: parseRecord(record.context),
    timestamp,
    interactionId:
      typeof record.interactionId === 'string' ? record.interactionId : undefined,
  };
}

export class OfflineSyncStrategy {
  static readonly SYNC_INTERVAL_MINUTES = 5;
  static readonly MAX_OFFLINE_BUFFER_XP = 100_000;
  static readonly MAX_OFFLINE_BUFFER_TP = 50_000;
  static readonly MAX_BUFFER_ENTRIES = 5_000;
  static readonly RETRY_DELAYS = [1, 2, 5, 10, 30, 60];

  private xpBuffer: OfflineXPEntry[] = [];
  private tpBuffer: OfflineTPEntry[] = [];
  private totalBufferedXp = 0;
  private totalBufferedTp = 0;
  private lastSyncAttempt?: string;
  private lastSuccessfulSync?: string;
  private syncFailures = 0;
  private currentRetryIndex = 0;

  constructor(
    private readonly persistPath: string = join(
      process.cwd(),
      '.nexus_cache',
      'offline-auth-buffer.json',
    ),
  ) {
    this.loadPersistedBuffer();
  }

  queueXp(
    amount: number,
    reason: string,
    context: Record<string, unknown> = {},
    interactionId?: string,
    missionId?: string,
  ): boolean {
    if (!Number.isFinite(amount) || amount <= 0) {
      return false;
    }
    if (this.totalBufferedXp + amount > OfflineSyncStrategy.MAX_OFFLINE_BUFFER_XP) {
      return false;
    }
    if (this.xpBuffer.length >= OfflineSyncStrategy.MAX_BUFFER_ENTRIES) {
      this.compactXpBuffer();
      if (this.xpBuffer.length >= OfflineSyncStrategy.MAX_BUFFER_ENTRIES) {
        return false;
      }
    }
    const entry: OfflineXPEntry = {
      amount,
      reason,
      context: { ...context },
      timestamp: new Date().toISOString(),
      interactionId,
      missionId,
    };
    this.xpBuffer.push(entry);
    this.totalBufferedXp += amount;
    this.savePersistedBuffer();
    return true;
  }

  queueTp(
    amount: number,
    reason: string,
    context: Record<string, unknown> = {},
    interactionId?: string,
  ): boolean {
    if (!Number.isFinite(amount) || amount <= 0) {
      return false;
    }
    if (this.totalBufferedTp + amount > OfflineSyncStrategy.MAX_OFFLINE_BUFFER_TP) {
      return false;
    }
    if (this.tpBuffer.length >= OfflineSyncStrategy.MAX_BUFFER_ENTRIES) {
      this.compactTpBuffer();
      if (this.tpBuffer.length >= OfflineSyncStrategy.MAX_BUFFER_ENTRIES) {
        return false;
      }
    }
    const entry: OfflineTPEntry = {
      amount,
      reason,
      context: { ...context },
      timestamp: new Date().toISOString(),
      interactionId,
    };
    this.tpBuffer.push(entry);
    this.totalBufferedTp += amount;
    this.savePersistedBuffer();
    return true;
  }

  clearSyncedEntries(xpCount: number, tpCount: number): void {
    if (xpCount > 0) {
      const consumed = this.xpBuffer.slice(0, xpCount);
      const consumedAmount = consumed.reduce((sum, entry) => sum + entry.amount, 0);
      this.xpBuffer = this.xpBuffer.slice(xpCount);
      this.totalBufferedXp = Math.max(0, this.totalBufferedXp - consumedAmount);
    }
    if (tpCount > 0) {
      const consumed = this.tpBuffer.slice(0, tpCount);
      const consumedAmount = consumed.reduce((sum, entry) => sum + entry.amount, 0);
      this.tpBuffer = this.tpBuffer.slice(tpCount);
      this.totalBufferedTp = Math.max(0, this.totalBufferedTp - consumedAmount);
    }
    if (!this.hasPendingSync() && existsSync(this.persistPath)) {
      unlinkSync(this.persistPath);
      return;
    }
    this.savePersistedBuffer();
  }

  hasPendingSync(): boolean {
    return this.xpBuffer.length > 0 || this.tpBuffer.length > 0;
  }

  isBufferFull(): boolean {
    return (
      this.totalBufferedXp >= OfflineSyncStrategy.MAX_OFFLINE_BUFFER_XP ||
      this.totalBufferedTp >= OfflineSyncStrategy.MAX_OFFLINE_BUFFER_TP ||
      this.xpBuffer.length >= OfflineSyncStrategy.MAX_BUFFER_ENTRIES ||
      this.tpBuffer.length >= OfflineSyncStrategy.MAX_BUFFER_ENTRIES
    );
  }

  getNextRetryDelay(): number {
    return OfflineSyncStrategy.RETRY_DELAYS[
      Math.min(
        this.currentRetryIndex,
        OfflineSyncStrategy.RETRY_DELAYS.length - 1,
      )
    ];
  }

  recordSyncSuccess(): void {
    this.lastSuccessfulSync = new Date().toISOString();
    this.syncFailures = 0;
    this.currentRetryIndex = 0;
  }

  recordSyncFailure(): void {
    this.lastSyncAttempt = new Date().toISOString();
    this.syncFailures += 1;
    this.currentRetryIndex = Math.min(
      this.currentRetryIndex + 1,
      OfflineSyncStrategy.RETRY_DELAYS.length - 1,
    );
  }

  getBufferStatus(): Record<string, unknown> {
    return {
      xpEntries: this.xpBuffer.length,
      xpTotal: this.totalBufferedXp,
      xpCapacityPercent:
        (this.totalBufferedXp / OfflineSyncStrategy.MAX_OFFLINE_BUFFER_XP) * 100,
      tpEntries: this.tpBuffer.length,
      tpTotal: this.totalBufferedTp,
      tpCapacityPercent:
        (this.totalBufferedTp / OfflineSyncStrategy.MAX_OFFLINE_BUFFER_TP) * 100,
      lastSyncAttempt: this.lastSyncAttempt,
      lastSuccessfulSync: this.lastSuccessfulSync,
      syncFailures: this.syncFailures,
      isFull: this.isBufferFull(),
    };
  }

  getXpBuffer(): OfflineXPEntry[] {
    return this.xpBuffer.map((entry) => cloneXpEntry(entry));
  }

  getTpBuffer(): OfflineTPEntry[] {
    return this.tpBuffer.map((entry) => cloneTpEntry(entry));
  }

  private compactXpBuffer(): void {
    if (this.xpBuffer.length < 10) {
      return;
    }
    const grouped = new Map<string, OfflineXPEntry[]>();
    for (const entry of this.xpBuffer) {
      const bucket = grouped.get(entry.reason) ?? [];
      bucket.push(entry);
      grouped.set(entry.reason, bucket);
    }
    const compacted: OfflineXPEntry[] = [];
    for (const [reason, entries] of grouped.entries()) {
      if (entries.length > 5) {
        const amount = entries.reduce((sum, entry) => sum + entry.amount, 0);
        compacted.push({
          amount,
          reason,
          context: { mergedCount: entries.length },
          timestamp: entries[entries.length - 1].timestamp,
        });
      } else {
        compacted.push(...entries);
      }
    }
    this.xpBuffer = compacted;
  }

  private compactTpBuffer(): void {
    if (this.tpBuffer.length < 10) {
      return;
    }
    const grouped = new Map<string, OfflineTPEntry[]>();
    for (const entry of this.tpBuffer) {
      const bucket = grouped.get(entry.reason) ?? [];
      bucket.push(entry);
      grouped.set(entry.reason, bucket);
    }
    const compacted: OfflineTPEntry[] = [];
    for (const [reason, entries] of grouped.entries()) {
      if (entries.length > 5) {
        const amount = entries.reduce((sum, entry) => sum + entry.amount, 0);
        compacted.push({
          amount,
          reason,
          context: { mergedCount: entries.length },
          timestamp: entries[entries.length - 1].timestamp,
        });
      } else {
        compacted.push(...entries);
      }
    }
    this.tpBuffer = compacted;
  }

  private loadPersistedBuffer(): void {
    if (!existsSync(this.persistPath)) {
      return;
    }
    try {
      const raw = JSON.parse(readFileSync(this.persistPath, 'utf8')) as unknown;
      const record = parseRecord(raw);
      const parsed: PersistedOfflineBuffer = {
        xpBuffer: [],
        tpBuffer: [],
        totalBufferedXp: parseNumber(record.totalBufferedXp, 0),
        totalBufferedTp: parseNumber(record.totalBufferedTp, 0),
      };
      const xpList = Array.isArray(record.xpBuffer) ? record.xpBuffer : [];
      const tpList = Array.isArray(record.tpBuffer) ? record.tpBuffer : [];
      for (const value of xpList) {
        const entry = parseXpEntry(value);
        if (entry) {
          parsed.xpBuffer.push(entry);
        }
      }
      for (const value of tpList) {
        const entry = parseTpEntry(value);
        if (entry) {
          parsed.tpBuffer.push(entry);
        }
      }
      this.xpBuffer = parsed.xpBuffer;
      this.tpBuffer = parsed.tpBuffer;
      this.totalBufferedXp = parsed.totalBufferedXp;
      this.totalBufferedTp = parsed.totalBufferedTp;
    } catch {
      this.xpBuffer = [];
      this.tpBuffer = [];
      this.totalBufferedXp = 0;
      this.totalBufferedTp = 0;
    }
  }

  private savePersistedBuffer(): void {
    const directory = dirname(this.persistPath);
    mkdirSync(directory, { recursive: true });
    const data: PersistedOfflineBuffer = {
      xpBuffer: this.getXpBuffer(),
      tpBuffer: this.getTpBuffer(),
      totalBufferedXp: this.totalBufferedXp,
      totalBufferedTp: this.totalBufferedTp,
    };
    writeFileSync(this.persistPath, JSON.stringify(data, null, 2), 'utf8');
  }
}

export type AuthApiRequest = {
  method: 'GET' | 'POST';
  endpoint: string;
  payload?: Record<string, unknown>;
  headers: Record<string, string>;
};

export type AuthApiResponse = Record<string, unknown>;
export type AuthApiRequester = (request: AuthApiRequest) => AuthApiResponse;

export class CitadelAuthClient {
  static readonly AGENT_VERSION = '4.0.0';
  static readonly RATE_LIMIT_PER_MINUTE = 60;
  static readonly HEARTBEAT_INTERVAL_MINUTES = 5;
  static readonly FEATURE_CACHE_TTL_MINUTES = 5;

  private sessionToken?: string;
  private userId?: string;
  private userTier: AgentFeatureTier = AgentFeatureTier.FREE;
  private sessionExpiresAt?: string;
  private lastHeartbeat?: string;
  private profile?: UserProfile;
  private featureCache = new Map<string, FeatureCacheEntry>();
  private requestTimestamps: string[] = [];

  totalApiCalls = 0;
  successfulApiCalls = 0;
  failedApiCalls = 0;
  totalXpSynced = 0;
  totalTpSynced = 0;

  constructor(
    private readonly options: {
      apiKey?: string;
      apiBaseUrl?: string;
      deviceId?: string;
      requester?: AuthApiRequester;
      enableOfflineSync?: boolean;
      autoAuthenticate?: boolean;
      offlinePersistPath?: string;
    } = {},
  ) {
    this.apiKey = options.apiKey ?? process.env.CITADEL_AGENT_API_KEY;
    this.apiBaseUrl = options.apiBaseUrl ?? process.env.CITADEL_AGENT_API_BASE ?? '';
    this.deviceId = options.deviceId ?? this.generateDeviceId();
    this.offlineSync = options.enableOfflineSync === false
      ? undefined
      : new OfflineSyncStrategy(options.offlinePersistPath);

    if (options.autoAuthenticate && this.apiKey) {
      this.authenticate();
    }
  }

  readonly apiKey?: string;
  readonly apiBaseUrl: string;
  readonly deviceId: string;
  readonly offlineSync?: OfflineSyncStrategy;

  get isAuthenticated(): boolean {
    if (!this.sessionToken) {
      return false;
    }
    if (!this.sessionExpiresAt) {
      return true;
    }
    return new Date(this.sessionExpiresAt).getTime() > Date.now();
  }

  authenticate(): AuthResult {
    if (!this.apiKey) {
      return {
        success: false,
        userTier: AgentFeatureTier.FREE,
        features: {},
        xpBalance: 0,
        tpBalance: 0,
        rank: 'INITIATE',
        rateLimitRemaining: CitadelAuthClient.RATE_LIMIT_PER_MINUTE,
        error: 'No API key configured',
      };
    }

    const response = this.makeRequest('POST', 'authenticate', {
      apiKey: this.apiKey,
      agentVersion: CitadelAuthClient.AGENT_VERSION,
      deviceId: this.deviceId,
    });

    if (response.error || response.success !== true) {
      return {
        success: false,
        userTier: AgentFeatureTier.FREE,
        features: {},
        xpBalance: 0,
        tpBalance: 0,
        rank: 'INITIATE',
        rateLimitRemaining: this.remainingRateLimit(),
        error: parseString(response.error, 'Authentication failed'),
      };
    }

    this.sessionToken = parseString(response.sessionToken, '');
    this.userId = parseString(response.userId, '');
    this.userTier = parseFeatureTier(parseString(response.userTier, AgentFeatureTier.FREE));
    this.sessionExpiresAt =
      typeof response.expiresAt === 'string' ? response.expiresAt : undefined;
    this.lastHeartbeat = new Date().toISOString();

    const featuresRecord = parseRecord(response.features);
    const features: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(featuresRecord)) {
      features[key] = value === true;
      const expiresAt = new Date(
        Date.now() + CitadelAuthClient.FEATURE_CACHE_TTL_MINUTES * 60_000,
      ).toISOString();
      this.featureCache.set(key, {
        featureKey: key,
        allowed: value === true,
        currentTier: this.userTier,
        requiredTier: value === true ? undefined : AGENT_FEATURE_TIERS[key],
        expiresAt,
        checkCount: 0,
      });
    }

    return {
      success: true,
      sessionToken: this.sessionToken,
      userId: this.userId,
      userTier: this.userTier,
      features,
      xpBalance: parseNumber(response.xpBalance, 0),
      tpBalance: parseNumber(response.tpBalance, 0),
      rank: parseString(response.rank, 'INITIATE'),
      expiresAt: this.sessionExpiresAt,
      rateLimitRemaining: this.remainingRateLimit(),
    };
  }

  checkFeature(
    featureKey: string,
    useCache: boolean = true,
  ): FeatureCheckResult {
    if (useCache) {
      const cached = this.featureCache.get(featureKey);
      if (cached && new Date(cached.expiresAt).getTime() > Date.now()) {
        cached.checkCount += 1;
        return {
          allowed: cached.allowed,
          featureKey,
          requiredTier: cached.requiredTier,
          currentTier: cached.currentTier,
          cached: true,
          cacheExpiresAt: cached.expiresAt,
        };
      }
    }

    const requiredTier = AGENT_FEATURE_TIERS[featureKey];
    if (requiredTier) {
      const allowed = tierAtLeast(this.userTier, requiredTier);
      const cacheEntry: FeatureCacheEntry = {
        featureKey,
        allowed,
        currentTier: this.userTier,
        requiredTier: allowed ? undefined : requiredTier,
        expiresAt: new Date(
          Date.now() + CitadelAuthClient.FEATURE_CACHE_TTL_MINUTES * 60_000,
        ).toISOString(),
        checkCount: 1,
      };
      this.featureCache.set(featureKey, cacheEntry);

      return {
        allowed,
        featureKey,
        reason: allowed ? undefined : `Requires ${requiredTier} tier`,
        requiredTier: allowed ? undefined : requiredTier,
        currentTier: this.userTier,
        upgradeUrl: allowed
          ? undefined
          : `https://citadel-nexus.com/upgrade?feature=${featureKey}`,
        cached: false,
        cacheExpiresAt: cacheEntry.expiresAt,
      };
    }

    return {
      allowed: false,
      featureKey,
      reason: 'Unknown feature',
      currentTier: this.userTier,
      cached: false,
    };
  }

  checkFeatures(featureKeys: string[]): Record<string, FeatureCheckResult> {
    const output: Record<string, FeatureCheckResult> = {};
    for (const key of featureKeys) {
      output[key] = this.checkFeature(key);
    }
    return output;
  }

  getAvailableFeatures(): string[] {
    const available: string[] = [];
    for (const [feature, requiredTier] of Object.entries(AGENT_FEATURE_TIERS)) {
      if (tierAtLeast(this.userTier, requiredTier)) {
        available.push(feature);
      }
    }
    return available;
  }

  getUpgradeFeatures(): Record<string, Record<string, string>> {
    const output: Record<string, Record<string, string>> = {};
    for (const [feature, requiredTier] of Object.entries(AGENT_FEATURE_TIERS)) {
      if (tierAtLeast(this.userTier, requiredTier)) {
        continue;
      }
      output[feature] = {
        requiredTier,
        description: FEATURE_DESCRIPTIONS[feature] ?? '',
        upgradeUrl: `https://citadel-nexus.com/upgrade?feature=${feature}`,
      };
    }
    return output;
  }

  syncXp(
    amount: number,
    reason: string,
    context: Record<string, unknown> = {},
    interactionId?: string,
    missionId?: string,
    forceSync: boolean = false,
  ): SyncResult {
    if (amount <= 0) {
      return this.syncError(amount, 'Invalid XP amount');
    }

    if (!this.isAuthenticated && !forceSync) {
      if (this.offlineSync?.queueXp(amount, reason, context, interactionId, missionId)) {
        return {
          success: true,
          requestedAmount: amount,
          validatedAmount: amount,
          newTotal: parseNumber(
            this.offlineSync.getBufferStatus().xpTotal,
            amount,
          ),
          rankChanged: false,
          badgesUnlocked: [],
          validationFlags: ['BUFFERED'],
        };
      }
      return this.syncError(amount, 'Not authenticated and unable to buffer XP');
    }

    const response = this.makeRequest('POST', 'sync-xp', {
      sessionToken: this.sessionToken,
      amount,
      reason,
      context,
      timestamp: new Date().toISOString(),
      interactionId,
      missionId,
    });

    if (response.error || response.success !== true) {
      this.offlineSync?.queueXp(amount, reason, context, interactionId, missionId);
      this.offlineSync?.recordSyncFailure();
      return {
        ...this.syncError(amount, parseString(response.error, 'XP sync failed')),
        validationFlags: this.offlineSync ? ['SYNC_FAILED', 'BUFFERED'] : ['SYNC_FAILED'],
      };
    }

    const validatedAmount = parseNumber(response.validatedAmount, amount);
    this.totalXpSynced += validatedAmount;
    this.offlineSync?.recordSyncSuccess();
    return {
      success: true,
      requestedAmount: amount,
      validatedAmount,
      newTotal: parseNumber(response.newTotal, validatedAmount),
      rankChanged: response.rankChanged === true,
      newRank: typeof response.newRank === 'string' ? response.newRank : undefined,
      badgesUnlocked: Array.isArray(response.badgesUnlocked)
        ? response.badgesUnlocked.filter((value): value is string => typeof value === 'string')
        : [],
      validationFlags: Array.isArray(response.validationFlags)
        ? response.validationFlags.filter((value): value is string => typeof value === 'string')
        : [],
    };
  }

  syncTp(
    amount: number,
    reason: string,
    context: Record<string, unknown> = {},
    interactionId?: string,
    forceSync: boolean = false,
  ): SyncResult {
    if (amount <= 0) {
      return this.syncError(amount, 'Invalid TP amount');
    }

    if (!this.isAuthenticated && !forceSync) {
      if (this.offlineSync?.queueTp(amount, reason, context, interactionId)) {
        return {
          success: true,
          requestedAmount: amount,
          validatedAmount: amount,
          newTotal: parseNumber(
            this.offlineSync.getBufferStatus().tpTotal,
            amount,
          ),
          rankChanged: false,
          badgesUnlocked: [],
          validationFlags: ['BUFFERED'],
        };
      }
      return this.syncError(amount, 'Not authenticated and unable to buffer TP');
    }

    const response = this.makeRequest('POST', 'sync-tp', {
      sessionToken: this.sessionToken,
      amount,
      reason,
      context,
      timestamp: new Date().toISOString(),
      interactionId,
    });

    if (response.error || response.success !== true) {
      this.offlineSync?.queueTp(amount, reason, context, interactionId);
      this.offlineSync?.recordSyncFailure();
      return {
        ...this.syncError(amount, parseString(response.error, 'TP sync failed')),
        validationFlags: this.offlineSync ? ['SYNC_FAILED', 'BUFFERED'] : ['SYNC_FAILED'],
      };
    }

    const validatedAmount = parseNumber(response.validatedAmount, amount);
    this.totalTpSynced += validatedAmount;
    this.offlineSync?.recordSyncSuccess();
    return {
      success: true,
      requestedAmount: amount,
      validatedAmount,
      newTotal: parseNumber(response.newTotal, validatedAmount),
      rankChanged: response.rankChanged === true,
      newRank: typeof response.newRank === 'string' ? response.newRank : undefined,
      badgesUnlocked: Array.isArray(response.badgesUnlocked)
        ? response.badgesUnlocked.filter((value): value is string => typeof value === 'string')
        : [],
      validationFlags: Array.isArray(response.validationFlags)
        ? response.validationFlags.filter((value): value is string => typeof value === 'string')
        : [],
    };
  }

  flushOfflineBuffer(): Record<string, unknown> {
    if (!this.offlineSync) {
      return { success: false, error: 'Offline sync not enabled' };
    }
    if (!this.offlineSync.hasPendingSync()) {
      return { success: true, message: 'No pending entries to sync' };
    }
    if (!this.isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    let xpEntriesProcessed = 0;
    let tpEntriesProcessed = 0;
    let xpSynced = 0;
    let tpSynced = 0;
    const errors: string[] = [];

    for (const entry of this.offlineSync.getXpBuffer()) {
      const result = this.syncXp(
        entry.amount,
        entry.reason,
        entry.context,
        entry.interactionId,
        entry.missionId,
        true,
      );
      if (!result.success) {
        errors.push(result.error ?? 'XP sync failed');
        break;
      }
      xpEntriesProcessed += 1;
      xpSynced += result.validatedAmount;
    }

    for (const entry of this.offlineSync.getTpBuffer()) {
      const result = this.syncTp(
        entry.amount,
        entry.reason,
        entry.context,
        entry.interactionId,
        true,
      );
      if (!result.success) {
        errors.push(result.error ?? 'TP sync failed');
        break;
      }
      tpEntriesProcessed += 1;
      tpSynced += result.validatedAmount;
    }

    this.offlineSync.clearSyncedEntries(xpEntriesProcessed, tpEntriesProcessed);

    return {
      success: errors.length === 0,
      xpSynced,
      tpSynced,
      xpEntriesProcessed,
      tpEntriesProcessed,
      errors,
    };
  }

  heartbeat(agentStats: Record<string, unknown> = {}): HeartbeatResult {
    if (!this.isAuthenticated) {
      return {
        sessionValid: false,
        featureUpdates: {},
        tierChanged: false,
        availableUpgrades: [],
        serverMessages: [],
        maintenanceMode: false,
      };
    }

    const response = this.makeRequest('POST', 'heartbeat', {
      sessionToken: this.sessionToken,
      agentStats,
      timestamp: new Date().toISOString(),
    });

    if (response.error || response.success !== true) {
      return {
        sessionValid: true,
        featureUpdates: {},
        tierChanged: false,
        availableUpgrades: [],
        serverMessages: [parseString(response.error, 'Heartbeat failed')],
        maintenanceMode: false,
      };
    }

    const featureUpdatesRecord = parseRecord(response.featureUpdates);
    const featureUpdates: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(featureUpdatesRecord)) {
      featureUpdates[key] = value === true;
    }

    const tierChanged = response.tierChanged === true;
    if (tierChanged && typeof response.newTier === 'string') {
      this.userTier = parseFeatureTier(response.newTier);
      this.featureCache.clear();
    }

    if (typeof response.expiresAt === 'string') {
      this.sessionExpiresAt = response.expiresAt;
    }
    this.lastHeartbeat = new Date().toISOString();

    return {
      sessionValid: true,
      newExpiresAt: this.sessionExpiresAt,
      featureUpdates,
      tierChanged,
      newTier: typeof response.newTier === 'string' ? response.newTier : undefined,
      availableUpgrades: Array.isArray(response.availableUpgrades)
        ? response.availableUpgrades.filter(
            (value): value is Record<string, unknown> =>
              typeof value === 'object' && value !== null,
          )
        : [],
      serverMessages: Array.isArray(response.messages)
        ? response.messages.filter((value): value is string => typeof value === 'string')
        : [],
      maintenanceMode: response.maintenanceMode === true,
    };
  }

  needsHeartbeat(): boolean {
    if (!this.lastHeartbeat) {
      return true;
    }
    const delta = Date.now() - new Date(this.lastHeartbeat).getTime();
    return delta >= CitadelAuthClient.HEARTBEAT_INTERVAL_MINUTES * 60_000;
  }

  getProfile(forceRefresh: boolean = false): UserProfile | undefined {
    if (this.profile && !forceRefresh) {
      return { ...this.profile, badges: [...this.profile.badges] };
    }
    if (!this.isAuthenticated) {
      return undefined;
    }
    const response = this.makeRequest('GET', 'profile');
    if (response.error || response.success !== true) {
      return undefined;
    }
    this.profile = {
      userId: parseString(response.userId, this.userId ?? ''),
      username: parseString(response.username, ''),
      email: typeof response.email === 'string' ? response.email : undefined,
      tier: parseString(response.tier, this.userTier),
      subscriptionStatus: parseString(response.subscriptionStatus, 'inactive'),
      subscriptionExpiresAt:
        typeof response.subscriptionExpiresAt === 'string'
          ? response.subscriptionExpiresAt
          : undefined,
      xpTotal: parseNumber(response.xpTotal, 0),
      tpTotal: parseNumber(response.tpTotal, 0),
      rank: parseString(response.rank, 'INITIATE'),
      rankProgress: parseNumber(response.rankProgress, 0),
      badges: Array.isArray(response.badges)
        ? response.badges.filter((value): value is string => typeof value === 'string')
        : [],
      badgeCount: parseNumber(response.badgeCount, 0),
      streakCurrent: parseNumber(response.streakCurrent, 0),
      streakBest: parseNumber(response.streakBest, 0),
      interactionsTotal: parseNumber(response.interactionsTotal, 0),
      missionsCompleted: parseNumber(response.missionsCompleted, 0),
      skillsUnlocked: Array.isArray(response.skillsUnlocked)
        ? response.skillsUnlocked.filter((value): value is string => typeof value === 'string')
        : [],
      guild: typeof response.guild === 'string' ? response.guild : undefined,
      createdAt: typeof response.createdAt === 'string' ? response.createdAt : undefined,
      lastActiveAt:
        typeof response.lastActiveAt === 'string' ? response.lastActiveAt : undefined,
    };
    return { ...this.profile, badges: [...this.profile.badges] };
  }

  getClientStatus(): Record<string, unknown> {
    return {
      authenticated: this.isAuthenticated,
      userId: this.userId,
      userTier: this.userTier,
      sessionExpiresAt: this.sessionExpiresAt,
      lastHeartbeat: this.lastHeartbeat,
      needsHeartbeat: this.needsHeartbeat(),
      apiCalls: {
        total: this.totalApiCalls,
        successful: this.successfulApiCalls,
        failed: this.failedApiCalls,
      },
      sync: {
        xpSynced: this.totalXpSynced,
        tpSynced: this.totalTpSynced,
      },
      featureCacheSize: this.featureCache.size,
      availableFeaturesCount: this.getAvailableFeatures().length,
      offlineBuffer: this.offlineSync?.getBufferStatus(),
    };
  }

  logout(): boolean {
    if (this.isAuthenticated) {
      this.makeRequest('POST', 'logout', { sessionToken: this.sessionToken });
    }
    this.sessionToken = undefined;
    this.userId = undefined;
    this.userTier = AgentFeatureTier.FREE;
    this.sessionExpiresAt = undefined;
    this.profile = undefined;
    this.featureCache.clear();
    return true;
  }

  private syncError(amount: number, error: string): SyncResult {
    return {
      success: false,
      requestedAmount: amount,
      validatedAmount: 0,
      newTotal: 0,
      rankChanged: false,
      badgesUnlocked: [],
      validationFlags: [],
      error,
    };
  }

  private generateDeviceId(): string {
    const raw = `${process.platform}:${process.arch}:${process.env.USER ?? ''}:${process.env.HOSTNAME ?? ''}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i += 1) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return `device-${Math.abs(hash).toString(16)}`;
  }

  private remainingRateLimit(): number {
    this.pruneRequestWindow();
    return Math.max(
      0,
      CitadelAuthClient.RATE_LIMIT_PER_MINUTE - this.requestTimestamps.length,
    );
  }

  private makeRequest(
    method: 'GET' | 'POST',
    endpoint: string,
    payload?: Record<string, unknown>,
  ): AuthApiResponse {
    if (!this.checkRateLimit()) {
      return { success: false, error: 'Rate limit exceeded' };
    }
    this.recordRequest();
    const requester = this.options.requester;
    if (!requester) {
      this.failedApiCalls += 1;
      return {
        success: false,
        error: 'No auth requester configured',
      };
    }
    try {
      const response = requester({
        method,
        endpoint,
        payload,
        headers: this.getHeaders(),
      });
      this.successfulApiCalls += 1;
      return response;
    } catch (error) {
      this.failedApiCalls += 1;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Request failed',
      };
    }
  }

  private checkRateLimit(): boolean {
    this.pruneRequestWindow();
    return this.requestTimestamps.length < CitadelAuthClient.RATE_LIMIT_PER_MINUTE;
  }

  private recordRequest(): void {
    this.totalApiCalls += 1;
    this.requestTimestamps.push(new Date().toISOString());
  }

  private pruneRequestWindow(): void {
    const cutoff = Date.now() - 60_000;
    this.requestTimestamps = this.requestTimestamps.filter((timestamp) => {
      return new Date(timestamp).getTime() > cutoff;
    });
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Agent-Version': CitadelAuthClient.AGENT_VERSION,
      'X-Device-ID': this.deviceId,
      'X-Auth-Base': this.apiBaseUrl,
    };
    if (this.sessionToken) {
      headers.Authorization = `Bearer ${this.sessionToken}`;
    }
    return headers;
  }
}

export class AuthIntegratedBrotherhoodSystem {
  localXp = 0;
  localTp = 0;
  serverXp = 0;
  serverTp = 0;
  rank = 'INITIATE';
  rankProgress = 0;
  lastServerSync?: string;
  pendingSync = false;

  constructor(
    readonly authClient: CitadelAuthClient,
    readonly localBrotherhood?: BrotherhoodSystem,
  ) {}

  awardXp(
    amount: number,
    reason: string,
    context: Record<string, unknown> = {},
    interactionId?: string,
    missionId?: string,
  ): SyncResult {
    this.localXp += amount;
    if (this.localBrotherhood) {
      this.localBrotherhood.totalXp += amount;
    }

    const result = this.authClient.syncXp(
      amount,
      reason,
      context,
      interactionId,
      missionId,
    );

    if (result.success) {
      this.serverXp = result.newTotal;
      if (result.newRank) {
        this.rank = result.newRank;
        if (this.localBrotherhood) {
          this.localBrotherhood.rank = parseFeatureRank(result.newRank);
        }
      }
      this.lastServerSync = new Date().toISOString();
      this.pendingSync = false;
    } else {
      this.pendingSync = true;
    }
    return result;
  }

  awardTp(
    amount: number,
    reason: string,
    context: Record<string, unknown> = {},
    interactionId?: string,
  ): SyncResult {
    this.localTp += amount;
    if (this.localBrotherhood) {
      this.localBrotherhood.totalTp += amount;
    }

    const result = this.authClient.syncTp(
      amount,
      reason,
      context,
      interactionId,
    );

    if (result.success) {
      this.serverTp = result.newTotal;
      this.lastServerSync = new Date().toISOString();
      this.pendingSync = false;
    } else {
      this.pendingSync = true;
    }
    return result;
  }

  getSyncStatus(): Record<string, unknown> {
    return {
      localXp: this.localXp,
      serverXp: this.serverXp,
      xpDiff: this.localXp - this.serverXp,
      localTp: this.localTp,
      serverTp: this.serverTp,
      tpDiff: this.localTp - this.serverTp,
      rank: this.rank,
      rankProgress: this.rankProgress,
      pendingSync: this.pendingSync,
      lastSync: this.lastServerSync,
      isSynced: this.localXp === this.serverXp && this.localTp === this.serverTp,
    };
  }
}

function parseFeatureRank(rank: string): BrotherhoodSystem['rank'] {
  const normalized = rank.toUpperCase();
  if (normalized === 'INITIATE') {
    return GameRank.INITIATE;
  }
  if (normalized === 'APPRENTICE') {
    return GameRank.APPRENTICE;
  }
  if (normalized === 'JOURNEYMAN') {
    return GameRank.JOURNEYMAN;
  }
  if (normalized === 'EXPERT') {
    return GameRank.EXPERT;
  }
  if (normalized === 'MASTER') {
    return GameRank.MASTER;
  }
  if (normalized === 'LEGEND') {
    return GameRank.LEGEND;
  }
  if (normalized === 'ARCHITECT') {
    return GameRank.ARCHITECT;
  }
  if (normalized === 'SAGE') {
    return GameRank.SAGE;
  }
  return GameRank.INITIATE;
}

export function requireFeature(
  featureKey: string,
  upgradeMessage?: string,
): <TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
) => (...args: TArgs) => TResult | undefined {
  return <TArgs extends unknown[], TResult>(fn: (...args: TArgs) => TResult) => {
    return function wrapped(this: { authClient?: CitadelAuthClient }, ...args: TArgs) {
      const authClient = this.authClient;
      if (!authClient) {
        return fn.apply(this, args);
      }
      const check = authClient.checkFeature(featureKey);
      if (!check.allowed) {
        if (upgradeMessage) {
          return undefined;
        }
        return undefined;
      }
      return fn.apply(this, args);
    };
  };
}

export function requireTier(
  minimumTier: AgentFeatureTier,
): <TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
) => (...args: TArgs) => TResult | undefined {
  return <TArgs extends unknown[], TResult>(fn: (...args: TArgs) => TResult) => {
    return function wrapped(this: { authClient?: CitadelAuthClient }, ...args: TArgs) {
      const authClient = this.authClient;
      if (!authClient) {
        return fn.apply(this, args);
      }
      const status = authClient.getClientStatus();
      const currentTier = parseFeatureTier(
        parseString(status.userTier, AgentFeatureTier.FREE),
      );
      if (!tierAtLeast(currentTier, minimumTier)) {
        return undefined;
      }
      return fn.apply(this, args);
    };
  };
}

let globalAuthClient: CitadelAuthClient | undefined;

export function getAuthClient(): CitadelAuthClient {
  if (!globalAuthClient) {
    globalAuthClient = new CitadelAuthClient();
  }
  return globalAuthClient;
}

export function initializeAuth(options: {
  apiKey?: string;
  autoAuthenticate?: boolean;
  requester?: AuthApiRequester;
} = {}): CitadelAuthClient {
  globalAuthClient = new CitadelAuthClient({
    apiKey: options.apiKey,
    autoAuthenticate: options.autoAuthenticate ?? true,
    requester: options.requester,
  });
  return globalAuthClient;
}