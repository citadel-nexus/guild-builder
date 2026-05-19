export type TenantTier = 'starter' | 'growth' | 'premium';

export type BrotherhoodRank =
  | 'initiate'
  | 'apprentice'
  | 'journeyman'
  | 'artisan'
  | 'master'
  | 'grandmaster'
  | 'elder'
  | 'legend';

export const BROTHERHOOD_RANK_ORDER: BrotherhoodRank[] = [
  'initiate',
  'apprentice',
  'journeyman',
  'artisan',
  'master',
  'grandmaster',
  'elder',
  'legend',
];

export const RANK_THRESHOLDS: Record<BrotherhoodRank, number> = {
  initiate: 0,
  apprentice: 100,
  journeyman: 500,
  artisan: 1500,
  master: 5000,
  grandmaster: 15000,
  elder: 50000,
  legend: 100000,
};

export type AuthorityTier =
  | 'OBSERVE'
  | 'ASSIST'
  | 'EXECUTE'
  | 'GOVERN'
  | 'ARCHITECT';

export const AUTHORITY_ORDER: AuthorityTier[] = [
  'OBSERVE',
  'ASSIST',
  'EXECUTE',
  'GOVERN',
  'ARCHITECT',
];

export const AUTHORITY_XP_GATES: Record<AuthorityTier, number> = {
  OBSERVE: 0,
  ASSIST: 100,
  EXECUTE: 1000,
  GOVERN: 5000,
  ARCHITECT: 25000,
};

export type AgentVitals = {
  energy: number;
  mood: number;
  focus: number;
  health: number;
  hunger: number;
  curiosity: number;
};

export type XpEvent = {
  amount: number;
  source: string;
  reason: string;
  timestamp: string;
  outcomeMultiplier?: number;
};

export type TpEvent = {
  amount: number;
  source: string;
  reason: string;
  timestamp: string;
};

export type CapsRating = {
  cognitive: number;
  autonomy: number;
  proficiency: number;
  social: number;
  overall: number;
};

export type BadgeCategory =
  | 'interaction'
  | 'memory'
  | 'governance'
  | 'integration'
  | 'knowledge'
  | 'economy'
  | 'autonomy'
  | 'social'
  | 'meta'
  | 'special';

export type Badge = {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  icon: string;
  xpReward: number;
  tpReward: number;
  condition: string;
  hidden: boolean;
};

export type SkillTreeId =
  | 'memory'
  | 'cognition'
  | 'autonomy'
  | 'governance'
  | 'economy'
  | 'integration';

export type SkillTier = 1 | 2 | 3 | 4 | 5;

export type Skill = {
  id: string;
  name: string;
  description: string;
  tree: SkillTreeId;
  tier: SkillTier;
  tpCost: number;
  prerequisites: string[];
  effects: Record<string, number>;
};

export type QuestType = 'daily' | 'weekly' | 'epic';
export type QuestStatus = 'available' | 'active' | 'completed' | 'expired';

export type Quest = {
  id: string;
  name: string;
  description: string;
  type: QuestType;
  status: QuestStatus;
  objectives: QuestObjective[];
  rewards: QuestRewards;
  expiresAt?: string;
};

export type QuestObjective = {
  id: string;
  description: string;
  target: number;
  current: number;
  completed: boolean;
};

export type QuestRewards = {
  xp: number;
  tp: number;
  badgeId?: string;
  skillPoints?: number;
};

export type MissionPriority = 'low' | 'medium' | 'high' | 'critical';
export type MissionStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'failed'
  | 'expired';

export type Mission = {
  id: string;
  title: string;
  description: string;
  priority: MissionPriority;
  status: MissionStatus;
  xpReward: number;
  tpReward: number;
  createdAt: string;
  completedAt?: string;
  context?: Record<string, unknown>;
};

export type ProfessorDomain =
  | 'security'
  | 'infrastructure'
  | 'frontend'
  | 'backend'
  | 'data'
  | 'ml'
  | 'devops'
  | 'architecture'
  | 'testing'
  | 'performance'
  | 'networking'
  | 'cloud'
  | 'database'
  | 'mobile'
  | 'blockchain'
  | 'ai_ethics'
  | 'ux'
  | 'accessibility'
  | 'i18n'
  | 'compliance'
  | 'finance'
  | 'marketing'
  | 'sales'
  | 'support'
  | 'hr'
  | 'legal'
  | 'operations'
  | 'strategy';

export type Professor = {
  id: string;
  name: string;
  domain: ProfessorDomain;
  expertise: string[];
  personality: string;
  catchphrase: string;
  trustScore: number;
};

export type CouncilStage = 'S00' | 'S01' | 'S02' | 'S03';
export type CouncilVerdict = 'approved' | 'denied' | 'escalated' | 'review';

export type CouncilDecision = {
  id: string;
  stage: CouncilStage;
  verdict: CouncilVerdict;
  reason: string;
  timestamp: string;
  hashChain: string;
};

export type AuditEntry = {
  id: string;
  event: string;
  actor: string;
  detail: string;
  timestamp: string;
  hash: string;
  prevHash: string;
};

export type ReflexPattern = {
  id: string;
  pattern: string;
  response: string;
  category: string;
  priority: number;
  authorityRequired: AuthorityTier;
  xpOnTrigger: number;
};

export type InsightType = 'pattern' | 'anomaly' | 'trend' | 'recommendation';

export type Insight = {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  confidence: number;
  data: Record<string, unknown>;
  generatedAt: string;
};

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  rank: BrotherhoodRank;
  xp: number;
  tp: number;
  capsGrade: number;
  guildId?: string;
};

export type AgentState = {
  version: string;
  agentId: string;
  vitals: AgentVitals;
  xp: number;
  tp: number;
  rank: BrotherhoodRank;
  authority: AuthorityTier;
  caps: CapsRating;
  badges: string[];
  skills: string[];
  activeMissions: Mission[];
  activeQuests: Quest[];
  streakDays: number;
  interactionCount: number;
  memoryCount: number;
  lastInteraction: string;
  createdAt: string;
};

export type AgentEventKind =
  | 'xp.earned'
  | 'tp.earned'
  | 'rank.up'
  | 'badge.unlocked'
  | 'skill.unlocked'
  | 'quest.completed'
  | 'mission.completed'
  | 'council.decision'
  | 'reflex.triggered'
  | 'insight.generated'
  | 'authority.upgraded'
  | 'vitals.updated'
  | 'interaction.processed'
  | 'professor.consulted'
  | 'heartbeat';

export type AgentEvent = {
  kind: AgentEventKind;
  agentId: string;
  data: Record<string, unknown>;
  timestamp: string;
};

export type CapabilityStatus =
  | 'planned'
  | 'in_progress'
  | 'complete'
  | 'verified';

export type ProgressionCapability = {
  id: string;
  name: string;
  description: string;
  category: string;
  status: CapabilityStatus;
  completionPercentage: number;
  dependencies: string[];
  srsCodes: string[];
  locEstimate: number;
  locActual: number;
};

export type McpToolEntry = {
  toolId: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handlerMethod: string;
  category: string;
  authorityTier: AuthorityTier;
  xpOnUse: number;
};

export type SkillCategory =
  | 'SKILL_MEMORY'
  | 'SKILL_COGNITION'
  | 'SKILL_AUTONOMY'
  | 'SKILL_GOVERNANCE'
  | 'SKILL_ECONOMY'
  | 'SKILL_INTEGRATION'
  | 'SKILL_OBSERVABILITY'
  | 'SKILL_UI'
  | 'SKILL_TESTING'
  | 'SKILL_META';

export type NexusTamagotchiConfig = {
  agentId: string;
  natsUrl: string;
  subjectPrefix: string;
  persistencePath?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  openaiApiKey?: string;
  natsToken?: string;
  debug: boolean;
};