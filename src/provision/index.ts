/**
 * Public entry point for the tenant provisioning spine.
 *
 * Dispatch: TENANT-PROVISION-FABRIC-001 §6.
 *
 * Public API:
 *   - ProvisionOrchestrator     — sequential, idempotent stage runner
 *   - InMemoryIdempotencyStore  — default checkpoint store (swap for prod)
 *   - defaultStageRegistry      — 9 stub stages in dispatch §F.1 order
 *   - makeStubStage             — helper for adding custom stub stages
 *   - ProvisionNatsBridge       — wires inbound walk-in events + outbound
 *                                 provision.* events to a NATS-like client
 *   - defaultSubjectFormatter   — matches dispatch §A.5 / §F.1 subject shape
 *
 * Concrete vendor provisioners (Cal.com, Mautic, Twenty, Customer.io,
 * Stalwart MTA, tenant agent, tenant MCP, cockpit UI, n8n workflow mesh)
 * live in their own service repos and plug in via the Stage interface.
 */
export type {
  IdempotencyKey,
  IdempotencyStore,
} from './idempotency.js';
export { InMemoryIdempotencyStore } from './idempotency.js';

export {
  DEFAULT_STAGE_NAMES,
  defaultStageRegistry,
  makeStubStage,
} from './stages/index.js';
export type { DefaultStageName } from './stages/index.js';

export { ProvisionOrchestrator } from './orchestrator.js';
export type { ProvisionOrchestratorOptions } from './orchestrator.js';

export {
  ProvisionNatsBridge,
} from './nats-bridge.js';
export type {
  NatsLikeClient,
  NatsLikeMessage,
  NatsLikeSubscription,
  ProvisionNatsBridgeOptions,
} from './nats-bridge.js';

export {
  defaultSubjectFormatter,
} from './subject-formatter.js';
export type { SubjectFormatter } from './subject-formatter.js';

export type {
  ProvisionEvent,
  ProvisionEventKind,
  ProvisionEventPublisher,
  ProvisionRunSummary,
  Stage,
  StageResult,
  StageStatus,
  TenantContext,
  TenantTier,
} from './types.js';
