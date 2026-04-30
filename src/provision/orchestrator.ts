/**
 * Sequential, idempotent tenant provisioning orchestrator.
 *
 * Dispatch: TENANT-PROVISION-FABRIC-001 §6 (Provisioning Orchestrator).
 *
 * Contract:
 *   - Runs Stages in declared order against a TenantContext
 *   - Skips already-completed stages by consulting the IdempotencyStore
 *   - Emits ProvisionEvents through an injected publisher (transport-agnostic)
 *   - Never throws on stage failure: returns a ProvisionRunSummary with
 *     status: 'failed' and the failed stage so callers can resume/retry
 *
 * Stage bodies (Cal.com / Mautic / Twenty / Customer.io / email-bank /
 * tenant-agent / tenant-mcp / cockpit-ui / workflow-mesh) are NOT included
 * here — they live in their own service repos and plug in by implementing
 * the Stage interface from ./types.ts.
 */
import {
  InMemoryIdempotencyStore,
  type IdempotencyStore,
} from './idempotency.js';
import { defaultStageRegistry } from './stages/index.js';
import type {
  ProvisionEvent,
  ProvisionEventPublisher,
  ProvisionRunSummary,
  Stage,
  StageResult,
  TenantContext,
} from './types.js';

export type ProvisionOrchestratorOptions = {
  stages?: Stage[];
  idempotency?: IdempotencyStore;
  publish?: ProvisionEventPublisher;
  now?: () => Date;
};

const NOOP_PUBLISHER: ProvisionEventPublisher = () => undefined;

export class ProvisionOrchestrator {
  private readonly stages: Stage[];
  private readonly idempotency: IdempotencyStore;
  private readonly publish: ProvisionEventPublisher;
  private readonly now: () => Date;

  constructor(options: ProvisionOrchestratorOptions = {}) {
    this.stages = options.stages ?? defaultStageRegistry();
    this.idempotency = options.idempotency ?? new InMemoryIdempotencyStore();
    this.publish = options.publish ?? NOOP_PUBLISHER;
    this.now = options.now ?? (() => new Date());

    const seen = new Set<string>();
    for (const stage of this.stages) {
      if (seen.has(stage.name)) {
        throw new Error(`duplicate stage name: ${stage.name}`);
      }
      seen.add(stage.name);
    }
  }

  /**
   * Returns the configured stage names in execution order. Useful for
   * surfacing the pipeline shape to the cockpit / dispatch UI without
   * exposing the Stage objects themselves.
   */
  stageNames(): string[] {
    return this.stages.map((s) => s.name);
  }

  async run(
    ctx: TenantContext,
    overrides: { publish?: ProvisionEventPublisher } = {},
  ): Promise<ProvisionRunSummary> {
    if (!ctx.tenantId) {
      throw new Error('TenantContext.tenantId is required');
    }

    const publish = overrides.publish ?? this.publish;
    const emit = async (partial: Omit<ProvisionEvent, 'timestamp'>) => {
      const event: ProvisionEvent = {
        ...partial,
        timestamp: this.now().toISOString(),
      };
      try {
        await publish(event);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `[provision] publisher threw on ${event.kind} for ${event.tenantId}: ${message}`,
        );
      }
    };

    const startedAt = this.now().toISOString();
    const results: StageResult[] = [];

    await emit({ kind: 'started', tenantId: ctx.tenantId });

    for (const stage of this.stages) {
      const cached = await this.idempotency.get({
        tenantId: ctx.tenantId,
        stage: stage.name,
      });

      if (cached && cached.status !== 'failed') {
        results.push(cached);
        await emit({
          kind: 'stage.done',
          tenantId: ctx.tenantId,
          stage: stage.name,
          result: cached,
        });
        continue;
      }

      await emit({
        kind: 'stage.started',
        tenantId: ctx.tenantId,
        stage: stage.name,
      });

      const result = await this.runStage(stage, ctx);
      results.push(result);

      await this.idempotency.put(
        { tenantId: ctx.tenantId, stage: stage.name },
        result,
      );

      if (result.status === 'failed') {
        await emit({
          kind: 'stage.failed',
          tenantId: ctx.tenantId,
          stage: stage.name,
          result,
          error: result.detail,
        });
        const finishedAt = this.now().toISOString();
        await emit({
          kind: 'failed',
          tenantId: ctx.tenantId,
          stage: stage.name,
          error: result.detail,
        });
        return {
          tenantId: ctx.tenantId,
          status: 'failed',
          stages: results,
          failedStage: stage.name,
          startedAt,
          finishedAt,
        };
      }

      await emit({
        kind: 'stage.done',
        tenantId: ctx.tenantId,
        stage: stage.name,
        result,
      });
    }

    const finishedAt = this.now().toISOString();
    await emit({ kind: 'complete', tenantId: ctx.tenantId });

    return {
      tenantId: ctx.tenantId,
      status: 'complete',
      stages: results,
      startedAt,
      finishedAt,
    };
  }

  private async runStage(stage: Stage, ctx: TenantContext): Promise<StageResult> {
    const startedAt = this.now().getTime();
    try {
      const partial = await stage.run(ctx);
      const durationMs = this.now().getTime() - startedAt;
      return { stage: stage.name, durationMs, ...partial };
    } catch (err) {
      const durationMs = this.now().getTime() - startedAt;
      const message = err instanceof Error ? err.message : String(err);
      return {
        stage: stage.name,
        status: 'failed',
        detail: message,
        durationMs,
      };
    }
  }
}
