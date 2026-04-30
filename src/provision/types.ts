/**
 * Tenant provisioning types — stage contract + event shapes.
 *
 * Dispatch: TENANT-PROVISION-FABRIC-001 (§6 Provisioning Orchestrator).
 * Builder Guild owns the orchestrator spine; per-vendor stage bodies
 * (Cal.com, Mautic, Twenty, Customer.io, Stalwart MTA, tenant agent,
 * tenant MCP, cockpit UI, n8n workflow mesh) live in their own services
 * and plug in by implementing the Stage interface.
 */

export type TenantTier = 'starter' | 'growth' | 'premium';

export type TenantContext = {
  tenantId: string;
  industry: string;
  tier: TenantTier;
  domain?: string;
  metadata?: Record<string, unknown>;
};

export type StageStatus = 'ok' | 'skipped' | 'stub' | 'failed';

export type StageResult = {
  stage: string;
  status: StageStatus;
  detail?: string;
  data?: Record<string, unknown>;
  durationMs: number;
};

export type Stage = {
  name: string;
  run: (ctx: TenantContext) => Promise<Omit<StageResult, 'stage' | 'durationMs'>>;
};

export type ProvisionEventKind =
  | 'started'
  | 'stage.started'
  | 'stage.done'
  | 'stage.failed'
  | 'complete'
  | 'failed';

export type ProvisionEvent = {
  kind: ProvisionEventKind;
  tenantId: string;
  stage?: string;
  result?: StageResult;
  error?: string;
  timestamp: string;
};

export type ProvisionEventPublisher = (event: ProvisionEvent) => void | Promise<void>;

export type ProvisionRunSummary = {
  tenantId: string;
  status: 'complete' | 'failed';
  stages: StageResult[];
  failedStage?: string;
  startedAt: string;
  finishedAt: string;
};
