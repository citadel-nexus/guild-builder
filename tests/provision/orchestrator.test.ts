import { describe, expect, it } from 'vitest';

import {
  InMemoryIdempotencyStore,
  ProvisionOrchestrator,
  type ProvisionEvent,
  type Stage,
  type TenantContext,
} from '../../src/provision/index.js';

function ctx(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    tenantId: 'bcx',
    industry: 'cosmetology',
    tier: 'growth',
    ...overrides,
  };
}

function recorder(): {
  events: ProvisionEvent[];
  publish: (event: ProvisionEvent) => void;
} {
  const events: ProvisionEvent[] = [];
  return {
    events,
    publish: (event) => {
      events.push(event);
    },
  };
}

describe('ProvisionOrchestrator (happy path)', () => {
  it('runs all default stub stages and returns a complete summary', async () => {
    const rec = recorder();
    const orchestrator = new ProvisionOrchestrator({ publish: rec.publish });

    const summary = await orchestrator.run(ctx());

    expect(summary.status).toBe('complete');
    expect(summary.tenantId).toBe('bcx');
    expect(summary.failedStage).toBeUndefined();
    expect(summary.stages).toHaveLength(9);
    expect(summary.stages.every((s) => s.status === 'stub')).toBe(true);
  });

  it('emits started + per-stage started/done + complete in order', async () => {
    const rec = recorder();
    const orchestrator = new ProvisionOrchestrator({ publish: rec.publish });

    await orchestrator.run(ctx());

    expect(rec.events[0].kind).toBe('started');
    expect(rec.events.at(-1)?.kind).toBe('complete');

    const stageEvents = rec.events.filter((e) =>
      e.kind === 'stage.started' || e.kind === 'stage.done',
    );
    // 9 stages × 2 lifecycle events
    expect(stageEvents).toHaveLength(18);

    // Each stage.started must precede its matching stage.done
    const startedAt: Record<string, number> = {};
    const doneAt: Record<string, number> = {};
    rec.events.forEach((e, i) => {
      if (e.kind === 'stage.started' && e.stage) {
        startedAt[e.stage] = i;
      } else if (e.kind === 'stage.done' && e.stage) {
        doneAt[e.stage] = i;
      }
    });
    for (const stage of Object.keys(startedAt)) {
      expect(doneAt[stage]).toBeGreaterThan(startedAt[stage]);
    }
  });

  it('rejects a context with no tenantId', async () => {
    const orchestrator = new ProvisionOrchestrator();
    await expect(
      orchestrator.run({ tenantId: '', industry: 'x', tier: 'starter' }),
    ).rejects.toThrow(/tenantId is required/);
  });

  it('rejects duplicate stage names at construction time', () => {
    const dup: Stage[] = [
      { name: 'a', run: async () => ({ status: 'ok' }) },
      { name: 'a', run: async () => ({ status: 'ok' }) },
    ];
    expect(() => new ProvisionOrchestrator({ stages: dup })).toThrow(
      /duplicate stage name/,
    );
  });

  it('reports configured stage names in execution order', () => {
    const orchestrator = new ProvisionOrchestrator();
    expect(orchestrator.stageNames()).toEqual([
      'calcom',
      'mautic',
      'twenty',
      'customer_io',
      'email_bank',
      'tenant_agent',
      'tenant_mcp',
      'cockpit_ui',
      'workflow_mesh',
    ]);
  });

  it('uses the per-call publisher override when provided', async () => {
    const ctor = recorder();
    const call = recorder();
    const orchestrator = new ProvisionOrchestrator({ publish: ctor.publish });

    await orchestrator.run(ctx(), { publish: call.publish });

    expect(ctor.events).toHaveLength(0);
    expect(call.events.length).toBeGreaterThan(0);
  });

  it('continues running when the publisher throws', async () => {
    const orchestrator = new ProvisionOrchestrator({
      publish: () => {
        throw new Error('publisher down');
      },
    });

    const summary = await orchestrator.run(ctx());
    expect(summary.status).toBe('complete');
  });

  it('shares the idempotency store across runs by default', async () => {
    const store = new InMemoryIdempotencyStore();
    const orchestrator = new ProvisionOrchestrator({ idempotency: store });

    await orchestrator.run(ctx());
    expect(await store.get({ tenantId: 'bcx', stage: 'calcom' })).toBeDefined();
  });
});
